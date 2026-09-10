import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { Repository } from '@ai-cost/database';
import { calculateCost, MODEL_CATALOG } from '@ai-cost/pricing';
import { ModelPricing } from '@ai-cost/types';
import { hashPassword, verifyPassword, generateApiKey, hashApiKey, DUMMY_PASSWORD_HASH } from './auth.js';

export interface ApiServerOptions {
  repo: Repository;
  jwtSecret?: string;
  logger?: boolean;
}

export function buildApiServer(options: ApiServerOptions): FastifyInstance {
  const { repo } = options;
  const rawJwtSecret = options.jwtSecret || process.env.JWT_SECRET;
  if (!rawJwtSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production environments. Set it to a strong random secret (32+ characters).');
    }
    console.warn('[ai-cost/api] WARNING: Running with fallback JWT secret. Set JWT_SECRET in production.');
  }
  const effectiveJwtSecret = rawJwtSecret || 'ai-cost-dev-insecure-jwt-secret-do-not-use-in-production';

  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production';
  const server = Fastify({
    logger: options.logger ?? false,
    trustProxy
  });

  if (process.env.NODE_ENV === 'production' && process.env.ENFORCE_HTTPS !== 'false') {
    server.addHook('onRequest', async (request, reply) => {
      const proto = request.headers['x-forwarded-proto'];
      if (proto && proto === 'http') {
        if (request.method === 'GET') {
          const host = request.headers.host || 'localhost';
          return reply.redirect(`https://${host}${request.raw.url || ''}`, 308);
        }
        return reply.status(403).send({ error: 'Insecure transport. HTTPS is required in production.' });
      }
    });
  }

  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  server.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-ai-cost-key', 'x-requested-with']
  });

  server.register(jwt, {
    secret: effectiveJwtSecret
  });

  // Auth decorator
  server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized. Please sign in.' });
    }
  });

  // Health and Readiness
  server.get('/health', async () => {
    return { status: 'ok', service: 'ai-cost-api', timestamp: new Date().toISOString() };
  });

  server.get('/ready', async (_, reply) => {
    try {
      const count = await repo.getUserCount();
      return { status: 'ready', userCount: count };
    } catch (err: any) {
      reply.status(503).send({ status: 'not_ready', error: err.message });
    }
  });

  // --- Auth & Setup ---

  server.get('/api/auth/status', async () => {
    const userCount = await repo.getUserCount();
    return { isSetup: userCount > 0 };
  });

  server.post('/api/auth/setup', async (request, reply) => {
    const userCount = await repo.getUserCount();
    if (userCount > 0) {
      return reply.status(400).send({ error: 'System has already been set up. Please log in.' });
    }

    const setupToken = process.env.AI_COST_SETUP_TOKEN;
    const body = request.body as any;
    if (setupToken) {
      const providedToken = body?.setupToken || (request.headers['x-setup-token'] as string);
      if (providedToken !== setupToken) {
        return reply.status(403).send({ error: 'Invalid setup token. Please provide the configured AI_COST_SETUP_TOKEN.' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return reply.status(503).send({
        error: 'Initial setup requires AI_COST_SETUP_TOKEN to be configured in production environments.'
      });
    }

    const email = body?.email?.trim();
    const password = body?.password;
    const name = body?.name?.trim() || 'Administrator';
    const orgName = body?.organizationName?.trim() || 'My Organization';

    if (!email || !password || password.length < 6) {
      return reply.status(400).send({ error: 'Email and password (min 6 chars) are required.' });
    }

    const org = await repo.createOrganization(orgName, 'default-org');
    const passwordHash = await hashPassword(password);
    const user = await repo.createUser({
      organizationId: org.id,
      email,
      passwordHash,
      name,
      role: 'owner'
    });

    // Create default project & initial API key
    const project = await repo.createProject({
      organizationId: org.id,
      name: 'Default Project',
      slug: 'default-project',
      description: 'Default project for AI workloads'
    });

    const keyData = generateApiKey();
    await repo.createApiKey({
      projectId: project.id,
      keyPrefix: keyData.keyPrefix,
      name: 'Initial Default Key',
      hashedKey: keyData.hashedKey
    });

    const token = server.jwt.sign(
      {
        userId: user.id,
        email: user.email,
        organizationId: org.id,
        role: user.role
      },
      {
        expiresIn: '24h'
      }
    );

    return {
      user,
      organization: org,
      project,
      initialApiKey: keyData.rawKey,
      token
    };
  });

  server.post('/api/auth/login', async (request, reply) => {
    const body = request.body as any;
    const email = body?.email?.trim();
    const password = body?.password;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required.' });
    }

    const user = await repo.getUserByEmail(email);
    const isValid = await verifyPassword(password, user?.password_hash || DUMMY_PASSWORD_HASH);
    if (!user || !isValid) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    const token = server.jwt.sign(
      {
        userId: user.id,
        email: user.email,
        organizationId: user.organization_id,
        role: user.role
      },
      {
        expiresIn: '24h'
      }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id
      }
    };
  });

  server.get('/api/auth/me', { preHandler: [(server as any).authenticate] }, async (request) => {
    const user = (request as any).user;
    const dbUser = await repo.getUserById(user.userId);
    return { user: dbUser };
  });

  // --- Authorization & Access Control Helpers ---

  function requireAuth() {
    return { preHandler: [(server as any).authenticate] };
  }

  function requireProjectAccess() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const project = await repo.getProjectById(id);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found.' });
      }
      const user = (request as any).user;
      if (project.organizationId !== user.organizationId) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this project.' });
      }
      (request as any).project = project;
    };
  }

  async function resolveOrgProjectIds(user: any, requestedProjectId?: string): Promise<{ authorized: boolean; projectIds?: string[]; singleProjectId?: string }> {
    if (requestedProjectId) {
      const project = await repo.getProjectById(requestedProjectId);
      if (!project || project.organizationId !== user.organizationId) {
        return { authorized: false };
      }
      return { authorized: true, singleProjectId: requestedProjectId };
    }
    const projects = await repo.listProjects(user.organizationId);
    const ids = projects.map(p => p.id);
    return { authorized: true, projectIds: ids };
  }

  // --- Projects & API Keys ---

  server.get('/api/projects', requireAuth(), async (request) => {
    const user = (request as any).user;
    const projects = await repo.listProjects(user.organizationId);
    return { projects };
  });

  server.post('/api/projects', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    const body = request.body as any;
    if (!body?.name) {
      return reply.status(400).send({ error: 'Project name is required.' });
    }

    const orgId = user.organizationId;
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const project = await repo.createProject({
      organizationId: orgId,
      name: body.name,
      slug: slug || `project-${Date.now()}`,
      description: body.description,
      environment: body.environment || 'production'
    });

    return { project };
  });

  server.delete('/api/projects/:id', { preHandler: [(server as any).authenticate, requireProjectAccess()] }, async (request) => {
    const { id } = request.params as { id: string };
    await repo.deleteProject(id);
    return { success: true };
  });

  server.get('/api/projects/:id/keys', { preHandler: [(server as any).authenticate, requireProjectAccess()] }, async (request) => {
    const { id } = request.params as { id: string };
    const keys = await repo.listApiKeys(id);
    return { keys };
  });

  server.post('/api/projects/:id/keys', { preHandler: [(server as any).authenticate, requireProjectAccess()] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const name = body?.name?.trim() || 'API Key';

    const keyData = generateApiKey();
    const apiKey = await repo.createApiKey({
      projectId: id,
      keyPrefix: keyData.keyPrefix,
      name,
      hashedKey: keyData.hashedKey
    });

    return {
      apiKey,
      rawKey: keyData.rawKey // Shown once
    };
  });

  server.delete('/api/keys/:id', requireAuth(), async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const key = await repo.getApiKeyById(id);
    if (!key) {
      return reply.status(404).send({ error: 'API key not found.' });
    }
    if (key.organizationId !== user.organizationId) {
      return reply.status(403).send({ error: 'Forbidden: You do not have access to this API key.' });
    }
    await repo.revokeApiKey(id);
    return { success: true };
  });

  // --- Analytics ---

  server.get('/api/analytics/overview', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as any;
    const access = await resolveOrgProjectIds(user, query.projectId);
    if (!access.authorized) {
      return reply.status(403).send({ error: 'Forbidden: You do not have access to this project.' });
    }

    const filter = {
      projectId: access.singleProjectId,
      projectIds: access.projectIds,
      provider: query.provider,
      model: query.model,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    };
    const overview = await repo.getOverviewMetrics(filter);
    return { overview };
  });

  server.get('/api/analytics/spend-over-time', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as any;
    const access = await resolveOrgProjectIds(user, query.projectId);
    if (!access.authorized) {
      return reply.status(403).send({ error: 'Forbidden: You do not have access to this project.' });
    }

    const filter = {
      projectId: access.singleProjectId,
      projectIds: access.projectIds,
      interval: query.interval === 'hour' ? 'hour' : 'day',
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    };
    const timeline = await repo.getSpendOverTime(filter as any);
    return { timeline };
  });

  server.get('/api/analytics/by-provider', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as any;
    const access = await resolveOrgProjectIds(user, query.projectId);
    if (!access.authorized) {
      return reply.status(403).send({ error: 'Forbidden: You do not have access to this project.' });
    }

    const filter = {
      projectId: access.singleProjectId,
      projectIds: access.projectIds,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    };
    const providers = await repo.getSpendByProvider(filter);
    return { providers };
  });

  server.get('/api/analytics/by-model', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as any;
    const access = await resolveOrgProjectIds(user, query.projectId);
    if (!access.authorized) {
      return reply.status(403).send({ error: 'Forbidden: You do not have access to this project.' });
    }

    const filter = {
      projectId: access.singleProjectId,
      projectIds: access.projectIds,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    };
    const models = await repo.getSpendByModel(filter);
    return { models };
  });

  server.get('/api/analytics/insights', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as any;
    const access = await resolveOrgProjectIds(user, query.projectId);
    if (!access.authorized) {
      return reply.status(403).send({ error: 'Forbidden: You do not have access to this project.' });
    }

    const insights = await repo.getCostInsights({ projectId: access.singleProjectId, projectIds: access.projectIds });
    return { insights };
  });

  // --- Requests Explorer ---

  server.get('/api/requests', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as any;
    const access = await resolveOrgProjectIds(user, query.projectId);
    if (!access.authorized) {
      return reply.status(403).send({ error: 'Forbidden: You do not have access to this project.' });
    }

    const filter = {
      projectId: access.singleProjectId,
      projectIds: access.projectIds,
      provider: query.provider,
      model: query.model,
      status: query.status,
      environment: query.environment,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 25
    };
    const result = await repo.listRequests(filter as any);
    return result;
  });

  server.get('/api/requests/:id', requireAuth(), async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const req = await repo.getRequestById(id);
    if (!req) {
      return reply.status(404).send({ error: 'Request not found.' });
    }
    const project = await repo.getProjectById(req.projectId);
    if (!project || project.organizationId !== user.organizationId) {
      return reply.status(403).send({ error: 'Forbidden: You do not have access to this request.' });
    }
    return { request: req };
  });

  // --- Budgets & Alerts ---

  server.get('/api/budgets', requireAuth(), async (request) => {
    const user = (request as any).user;
    const budgets = await repo.listBudgets(user.organizationId);
    return { budgets };
  });

  server.post('/api/budgets', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    const body = request.body as any;
    if (!body?.projectId || body?.monthlyBudgetUsd === undefined) {
      return reply.status(400).send({ error: 'projectId and monthlyBudgetUsd are required.' });
    }
    const project = await repo.getProjectById(body.projectId);
    if (!project || project.organizationId !== user.organizationId) {
      return reply.status(403).send({ error: 'Forbidden: You do not have access to this project.' });
    }
    const budget = await repo.setBudget({
      projectId: body.projectId,
      monthlyBudgetUsd: Number(body.monthlyBudgetUsd),
      alertThresholdPercent: body.alertThresholdPercent ? Number(body.alertThresholdPercent) : 80
    });
    return { budget };
  });

  server.get('/api/alerts', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as any;
    if (query.projectId) {
      const project = await repo.getProjectById(query.projectId);
      if (!project || project.organizationId !== user.organizationId) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this project.' });
      }
    }
    const alerts = await repo.listAlerts(query.projectId, query.resolved === 'true', user.organizationId);
    return { alerts };
  });

  server.post('/api/alerts/:id/resolve', requireAuth(), async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const alert = await repo.getAlertById(id);
    if (!alert) {
      return reply.status(404).send({ error: 'Alert not found.' });
    }
    if (alert.organizationId !== user.organizationId) {
      return reply.status(403).send({ error: 'Forbidden: You do not have access to this alert.' });
    }
    await repo.resolveAlert(id);
    return { success: true };
  });

  // --- Pricing Catalog ---

  server.get('/api/pricing', requireAuth(), async () => {
    const custom = await repo.listCustomPricing().catch(() => []);
    return {
      official: MODEL_CATALOG,
      custom
    };
  });

  server.post('/api/pricing/custom', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden: Administrator privileges required.' });
    }
    const body = request.body as any;
    if (!body?.provider || !body?.model || body?.inputCostPerMillion === undefined || body?.outputCostPerMillion === undefined) {
      return reply.status(400).send({ error: 'provider, model, inputCostPerMillion and outputCostPerMillion are required.' });
    }
    const pricing: ModelPricing = {
      provider: body.provider.trim().toLowerCase(),
      model: body.model.trim().toLowerCase(),
      displayName: body.displayName || body.model,
      inputCostPerMillion: Number(body.inputCostPerMillion),
      outputCostPerMillion: Number(body.outputCostPerMillion),
      cachedInputCostPerMillion: body.cachedInputCostPerMillion ? Number(body.cachedInputCostPerMillion) : undefined,
      isCustom: true
    };
    await repo.setCustomPricing(pricing);
    return { pricing };
  });

  server.delete('/api/pricing/custom/:provider/:model', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden: Administrator privileges required.' });
    }
    const { provider, model } = request.params as { provider: string; model: string };
    await repo.deleteCustomPricing(provider, model);
    return { success: true };
  });

  // --- Direct SDK Ingestion ---

  server.post('/api/usage/track', async (request, reply) => {
    const body = request.body as any;
    const batch = Array.isArray(body?.batch) ? body.batch : (body ? [body] : []);

    if (batch.length === 0) {
      return { received: 0 };
    }

    // Authenticate project strictly from API key
    const authHeader = request.headers['authorization'];
    const customHeader = request.headers['x-ai-cost-key'] as string | undefined;

    let rawKey = customHeader;
    if (!rawKey && authHeader && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7).trim();
    }

    if (!rawKey) {
      return reply.status(401).send({ error: 'Unauthorized: Missing AI Cost API key.' });
    }

    const hashed = hashApiKey(rawKey);
    const keyRecord = await repo.getApiKeyByHashedKey(hashed);

    if (!keyRecord) {
      return reply.status(401).send({ error: 'Unauthorized: Invalid or revoked AI Cost API key.' });
    }

    const projectId = keyRecord.projectId; // Strictly resolved from authenticated API key
    repo.updateApiKeyLastUsed(keyRecord.id).catch(() => {});

    const customPricing = await repo.listCustomPricing().catch(() => []);

    for (const item of batch) {
      const costResult = calculateCost({
        provider: item.provider,
        model: item.model,
        inputTokens: item.inputTokens,
        outputTokens: item.outputTokens,
        cachedTokens: item.cachedTokens,
        customPricing
      });

      await repo.recordRequest({
        requestId: item.requestId,
        projectId, // Enforce verified project ID, ignoring any caller-supplied projectId
        provider: item.provider,
        model: item.model,
        inputTokens: item.inputTokens,
        outputTokens: item.outputTokens,
        cachedTokens: item.cachedTokens,
        totalTokens: item.totalTokens || (item.inputTokens + item.outputTokens),
        estimatedCost: costResult.totalCost,
        latencyMs: item.latencyMs,
        statusCode: item.statusCode || 200,
        status: item.status || 'success',
        errorMessage: item.errorMessage,
        tags: item.tags,
        userId: item.userId,
        environment: item.environment || 'production',
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
      });
    }

    return { received: batch.length, status: 'ok' };
  });

  server.post('/api/admin/cleanup', requireAuth(), async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden: Administrator privileges required.' });
    }
    const body = request.body as any;
    const days = parseInt(body?.days || process.env.DATA_RETENTION_DAYS || '90', 10);
    const purged = await repo.purgeOldRequests(days);
    return { purged, daysRetained: days };
  });

  return server;
}
