import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabaseClient, Repository, IDatabaseClient } from '@ai-cost/database';
import { buildApiServer } from '../src/server.js';
import { FastifyInstance } from 'fastify';

describe('AI Cost API Server', () => {
  let db: IDatabaseClient;
  let repo: Repository;
  let server: FastifyInstance;
  let authToken: string;
  let createdProjectId: string;
  let createdApiKey: string;

  beforeAll(async () => {
    db = await createDatabaseClient();
    repo = new Repository(db);
    server = buildApiServer({ repo, logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await db.close();
  });

  it('reports initial setup status as false, then performs setup', async () => {
    const statusRes = await server.inject({ method: 'GET', url: '/api/auth/status' });
    expect(JSON.parse(statusRes.body).isSetup).toBe(false);

    const setupRes = await server.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: {
        email: 'admin@test.org',
        password: 'securepassword123',
        name: 'Super Admin',
        organizationName: 'Primary Org'
      }
    });

    expect(setupRes.statusCode).toBe(200);
    const body = JSON.parse(setupRes.body);
    expect(body.user.email).toBe('admin@test.org');
    expect(body.initialApiKey).toMatch(/^ac_live_[a-f0-9]+$/);
    expect(body.token).toBeDefined();

    authToken = body.token;

    // Verify subsequent setup attempts are rejected once initialized
    const secondSetup = await server.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: { email: 'attacker@test.org', password: 'password123' }
    });
    expect(secondSetup.statusCode).toBe(400);
  });

  it('authenticates user via login', async () => {
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@test.org',
        password: 'securepassword123'
      }
    });

    expect(loginRes.statusCode).toBe(200);
    const body = JSON.parse(loginRes.body);
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('admin@test.org');
  });

  it('creates project and generates API key', async () => {
    const projRes = await server.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: 'Customer Support Bot', description: 'Bot for customer inquiries' }
    });

    expect(projRes.statusCode).toBe(200);
    const projBody = JSON.parse(projRes.body);
    expect(projBody.project.name).toBe('Customer Support Bot');
    createdProjectId = projBody.project.id;

    // Create API Key for this project (requires auth)
    const keyRes = await server.inject({
      method: 'POST',
      url: `/api/projects/${createdProjectId}/keys`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: 'Prod Bot Key' }
    });

    expect(keyRes.statusCode).toBe(200);
    const keyBody = JSON.parse(keyRes.body);
    expect(keyBody.rawKey).toMatch(/^ac_live_/);
    expect(keyBody.apiKey.keyPrefix).toBeDefined();
    createdApiKey = keyBody.rawKey;

    // Verify keys listing redacts the raw key
    const listKeysRes = await server.inject({
      method: 'GET',
      url: `/api/projects/${createdProjectId}/keys`,
      headers: { authorization: `Bearer ${authToken}` }
    });
    const listBody = JSON.parse(listKeysRes.body);
    expect(listBody.keys.length).toBe(1);
    expect(listBody.keys[0].hashedKey).toBe('***');
  });

  it('rejects unauthenticated requests to protected endpoints', async () => {
    const unauthProjects = await server.inject({ method: 'GET', url: '/api/projects' });
    expect(unauthProjects.statusCode).toBe(401);

    const unauthAnalytics = await server.inject({ method: 'GET', url: '/api/analytics/overview' });
    expect(unauthAnalytics.statusCode).toBe(401);

    const unauthRequests = await server.inject({ method: 'GET', url: '/api/requests' });
    expect(unauthRequests.statusCode).toBe(401);

    const unauthCleanup = await server.inject({ method: 'POST', url: '/api/admin/cleanup' });
    expect(unauthCleanup.statusCode).toBe(401);
  });

  it('accepts SDK batch tracking and serves analytics', async () => {
    const trackRes = await server.inject({
      method: 'POST',
      url: '/api/usage/track',
      headers: { authorization: `Bearer ${createdApiKey}` },
      payload: {
        batch: [
          {
            requestId: 'sdk-req-1',
            projectId: 'spoofed-victim-id', // Caller-supplied projectId should be safely ignored
            provider: 'openai',
            model: 'gpt-4o',
            inputTokens: 1500,
            outputTokens: 600,
            latencyMs: 520,
            status: 'success'
          },
          {
            requestId: 'sdk-req-2',
            projectId: 'spoofed-victim-id',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-latest',
            inputTokens: 3000,
            outputTokens: 1200,
            cachedTokens: 2000,
            latencyMs: 890,
            status: 'success'
          }
        ]
      }
    });

    expect(trackRes.statusCode).toBe(200);
    expect(JSON.parse(trackRes.body).received).toBe(2);

    // Verify overview metrics
    const overviewRes = await server.inject({
      method: 'GET',
      url: `/api/analytics/overview?projectId=${createdProjectId}`,
      headers: { authorization: `Bearer ${authToken}` }
    });
    const overview = JSON.parse(overviewRes.body).overview;
    expect(overview.totalRequests).toBe(2);
    expect(overview.totalTokens).toBe(6300);
    expect(overview.totalCost).toBeGreaterThan(0);

    // Verify request log
    const reqLogRes = await server.inject({
      method: 'GET',
      url: `/api/requests?projectId=${createdProjectId}`,
      headers: { authorization: `Bearer ${authToken}` }
    });
    const reqLog = JSON.parse(reqLogRes.body);
    expect(reqLog.data.length).toBe(2);
    expect(reqLog.pagination.total).toBe(2);
  });

  it('manages budgets and custom pricing via API', async () => {
    const budgetRes = await server.inject({
      method: 'POST',
      url: '/api/budgets',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        projectId: createdProjectId,
        monthlyBudgetUsd: 150.0,
        alertThresholdPercent: 85
      }
    });
    expect(budgetRes.statusCode).toBe(200);
    expect(JSON.parse(budgetRes.body).budget.monthlyBudgetUsd).toBe(150.0);

    // Add custom pricing
    const pricingRes = await server.inject({
      method: 'POST',
      url: '/api/pricing/custom',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        provider: 'custom-provider',
        model: 'llama-fine-tuned',
        displayName: 'Fine-Tuned Llama',
        inputCostPerMillion: 2.0,
        outputCostPerMillion: 6.0
      }
    });
    expect(pricingRes.statusCode).toBe(200);

    const getPricingRes = await server.inject({
      method: 'GET',
      url: '/api/pricing',
      headers: { authorization: `Bearer ${authToken}` }
    });
    const pricingList = JSON.parse(getPricingRes.body);
    expect(pricingList.custom.some((c: any) => c.model === 'llama-fine-tuned')).toBe(true);
  });

  it('refuses to start in production if JWT_SECRET is missing', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => buildApiServer({ repo, logger: false })).toThrow(/JWT_SECRET is required in production/);
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalSecret) process.env.JWT_SECRET = originalSecret;
    }
  });
});
