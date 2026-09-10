import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { Repository } from '@ai-cost/database';
import { calculateCost, MODEL_CATALOG } from '@ai-cost/pricing';
import { ModelPricing } from '@ai-cost/types';
import { hashPassword, verifyPassword, generateApiKey, hashApiKey } from './auth.js';

export interface ApiServerOptions {
  repo: Repository;
  jwtSecret?: string;
  logger?: boolean;
}

export function buildApiServer(options: ApiServerOptions): FastifyInstance {
  const { repo } = options;
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET || 'ai-cost-super-secret-key-change-in-production';

  const server = Fastify({
    logger: options.logger ?? false
  });

  server.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  server.register(jwt, {
    secret: jwtSecret
  });

  // Auth decorator
  server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
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

    const body = request.body as any;
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

    const token = server.jwt.sign({
      userId: user.id,
      email: user.email,
      organizationId: org.id,
      role: user.role
    });

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
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    const token = server.jwt.sign({
      userId: user.id,
      email: user.email,
      organizationId: user.organization_id,
      role: user.role
    });

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

  // --- Projects & API Keys ---

  server.get('/api/projects', async (request) => {
    // In local demo or authenticated mode
    const user = (request as any).user;
    const orgId = user?.organizationId || 'default-org';
    const org = await repo.getOrganizationBySlug(orgId) || await repo.getOrganizationBySlug('default-org');
    const projects = await repo.listProjects(org ? org.id : orgId);
    return { projects };
  });

  server.post('/api/projects', async (request, reply) => {
    const user = (request as any).user;
    const body = request.body as any;
    if (!body?.name) {
      return reply.status(400).send({ error: 'Project name is required.' });
    }

    const orgId = user?.organizationId || (await repo.getOrganizationBySlug('default-org'))?.id;
    if (!orgId) {
      return reply.status(400).send({ error: 'Organization not found. Run setup first.' });
    }

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

  server.delete('/api/projects/:id', async (request) => {
    const { id } = request.params as { id: string };
    await repo.deleteProject(id);
    return { success: true };
  });

  server.get('/api/projects/:id/keys', async (request) => {
    const { id } = request.params as { id: string };
    const keys = await repo.listApiKeys(id);
    return { keys };
  });

  server.post('/api/projects/:id/keys', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const name = body?.name?.trim() || 'API Key';

    const project = await repo.getProjectById(id);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found.' });
    }

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

  server.delete('/api/keys/:id', async (request) => {
    const { id } = request.params as { id: string };
    await repo.revokeApiKey(id);
    return { success: true };
  });

  // --- Analytics ---

  server.get('/api/analytics/overview', async (request) => {
    const query = request.query as any;
    const filter = {
      projectId: query.projectId,
      provider: query.provider,
      model: query.model,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    };
    const overview = await repo.getOverviewMetrics(filter);
    return { overview };
  });

  server.get('/api/analytics/spend-over-time', async (request) => {
    const query = request.query as any;
    const filter = {
      projectId: query.projectId,
      interval: query.interval === 'hour' ? 'hour' : 'day',
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    };
    const timeline = await repo.getSpendOverTime(filter as any);
    return { timeline };
  });

  server.get('/api/analytics/by-provider', async (request) => {
    const query = request.query as any;
    const filter = {
      projectId: query.projectId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    };
    const providers = await repo.getSpendByProvider(filter);
    return { providers };
  });

  server.get('/api/analytics/by-model', async (request) => {
    const query = request.query as any;
    const filter = {
      projectId: query.projectId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    };
    const models = await repo.getSpendByModel(filter);
    return { models };
  });

  server.get('/api/analytics/insights', async (request) => {
    const query = request.query as any;
    const insights = await repo.getCostInsights({ projectId: query.projectId });
    return { insights };
  });

  // --- Requests Explorer ---

  server.get('/api/requests', async (request) => {
    const query = request.query as any;
    const filter = {
      projectId: query.projectId,
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
    const result = await repo.listRequests(filter);
    return result;
  });

  server.get('/api/requests/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const req = await repo.getRequestById(id);
    if (!req) {
      return reply.status(404).send({ error: 'Request not found.' });
    }
    return { request: req };
  });

  // --- Budgets & Alerts ---

  server.get('/api/budgets', async (request) => {
    const query = request.query as any;
    const budgets = await repo.listBudgets(query.organizationId);
    return { budgets };
  });

  server.post('/api/budgets', async (request, reply) => {
    const body = request.body as any;
    if (!body?.projectId || body?.monthlyBudgetUsd === undefined) {
      return reply.status(400).send({ error: 'projectId and monthlyBudgetUsd are required.' });
    }
    const budget = await repo.setBudget({
      projectId: body.projectId,
      monthlyBudgetUsd: Number(body.monthlyBudgetUsd),
      alertThresholdPercent: body.alertThresholdPercent ? Number(body.alertThresholdPercent) : 80
    });
    return { budget };
  });

  server.get('/api/alerts', async (request) => {
    const query = request.query as any;
    const alerts = await repo.listAlerts(query.projectId, query.resolved === 'true');
    return { alerts };
  });

  server.post('/api/alerts/:id/resolve', async (request) => {
    const { id } = request.params as { id: string };
    await repo.resolveAlert(id);
    return { success: true };
  });

  // --- Pricing Catalog ---

  server.get('/api/pricing', async () => {
    const custom = await repo.listCustomPricing().catch(() => []);
    return {
      official: MODEL_CATALOG,
      custom
    };
  });

  server.post('/api/pricing/custom', async (request, reply) => {
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

  server.delete('/api/pricing/custom/:provider/:model', async (request) => {
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

    // Authenticate project from header if present
    const authHeader = request.headers['authorization'];
    let projectId = 'default-project';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token.startsWith('ac_live_') || token.startsWith('ac_test_')) {
        const hashed = hashApiKey(token);
        const keyRecord = await repo.getApiKeyByHashedKey(hashed);
        if (keyRecord) {
          projectId = keyRecord.projectId;
        }
      }
    }

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
        projectId: item.projectId || projectId,
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

  // --- Admin Retention Cleanup ---

  server.post('/api/admin/cleanup', async (request, reply) => {
    const body = request.body as any;
    const days = parseInt(body?.days || process.env.DATA_RETENTION_DAYS || '90', 10);
    const purged = await repo.purgeOldRequests(days);
    return { purged, daysRetained: days };
  });

  return server;
}
