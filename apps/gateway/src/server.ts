import { randomUUID } from 'node:crypto';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { calculateCost, MODEL_CATALOG } from '@ai-cost/pricing';
import { Repository } from '@ai-cost/database';
import { AIRequestUsage } from '@ai-cost/types';
import { createAuthMiddleware } from './auth.js';
import { UsageQueue } from './queue.js';
import { resolveProvider, forwardToProvider } from './providers/router.js';

export interface ServerOptions {
  repo: Repository;
  queue?: UsageQueue;
  logger?: boolean;
}

export function buildServer(options: ServerOptions): FastifyInstance {
  const { repo } = options;
  const queue = options.queue || new UsageQueue(repo);

  const server = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 10 * 1024 * 1024 // 10MB limit
  });

  server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-ai-cost-key', 'x-provider-api-key', 'x-provider', 'x-environment', 'x-request-id']
  });

  // Health and Readiness
  server.get('/health', async () => {
    return { status: 'ok', service: 'ai-cost-gateway', timestamp: new Date().toISOString() };
  });

  server.get('/ready', async (_, reply) => {
    try {
      return { status: 'ready', database: 'connected' };
    } catch (err: any) {
      reply.status(503).send({ status: 'not_ready', error: err.message });
    }
  });

  // Models catalog in OpenAI format
  server.get('/v1/models', async () => {
    const customModels = await repo.listCustomPricing().catch(() => []);
    const allModels = [...MODEL_CATALOG, ...customModels];

    return {
      object: 'list',
      data: allModels.map(m => ({
        id: m.model,
        object: 'model',
        created: 1700000000,
        owned_by: m.provider,
        permission: [],
        root: m.model,
        parent: null
      }))
    };
  });

  const authMiddleware = createAuthMiddleware(repo);

  // OpenAI-Compatible Chat Completions Endpoint
  server.post('/v1/chat/completions', { preHandler: [authMiddleware] }, async (request, reply) => {
    const auth = (request as any).auth;
    const body = request.body as any;

    if (!body || !body.model) {
      return reply.status(400).send({
        error: {
          message: 'Missing "model" field in request body.',
          type: 'invalid_request_error',
          code: 'model_required'
        }
      });
    }

    const requestId = (request.headers['x-request-id'] as string) || `req_${randomUUID()}`;
    const model = body.model;
    const explicitProvider = request.headers['x-provider'] as string | undefined;
    const provider = resolveProvider(model, explicitProvider);
    const environment = (request.headers['x-environment'] as string) || 'production';

    const startTime = Date.now();

    // Forward to selected provider
    const result = await forwardToProvider(provider, {
      model,
      body,
      providerApiKey: auth.providerApiKey,
      requestId
    });

    const latencyMs = Date.now() - startTime;

    // Retrieve custom pricing if exists
    const customPricing = await repo.listCustomPricing().catch(() => []);
    const costBreakdown = calculateCost({
      provider,
      model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens: result.cachedTokens,
      customPricing
    });

    // Record usage asynchronously
    const usageRecord: AIRequestUsage = {
      id: randomUUID(),
      requestId,
      projectId: auth.projectId,
      provider,
      model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens: result.cachedTokens,
      totalTokens: result.inputTokens + result.outputTokens,
      estimatedCost: costBreakdown.totalCost,
      latencyMs,
      statusCode: result.statusCode,
      status: result.statusCode < 400 ? 'success' : 'error',
      errorMessage: result.errorMessage,
      environment,
      timestamp: new Date()
    };

    queue.enqueue(usageRecord);

    // AI Cost response observability headers
    reply.header('x-ai-cost-request-id', requestId);
    reply.header('x-ai-cost-estimated-cost', costBreakdown.totalCost.toFixed(6));
    reply.header('x-ai-cost-latency-ms', latencyMs.toString());
    reply.header('x-ai-cost-tokens-input', result.inputTokens.toString());
    reply.header('x-ai-cost-tokens-output', result.outputTokens.toString());
    reply.header('x-ai-cost-tokens-total', (result.inputTokens + result.outputTokens).toString());

    return reply.status(result.statusCode).send(result.body);
  });

  return server;
}
