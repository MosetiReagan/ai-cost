import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { createDatabaseClient, Repository, IDatabaseClient } from '../src/index.js';

describe('Database & Aggregation Engine', () => {
  let db: IDatabaseClient;
  let repo: Repository;

  beforeAll(async () => {
    // In-memory PGlite instance for testing
    db = await createDatabaseClient();
    repo = new Repository(db);
  });

  afterAll(async () => {
    await db.close();
  });

  it('creates organization, user, project and API key', async () => {
    const org = await repo.createOrganization('Acme AI', 'acme-ai');
    expect(org.id).toBeDefined();

    const user = await repo.createUser({
      organizationId: org.id,
      email: 'admin@acme.ai',
      passwordHash: 'hashed_pw_123',
      name: 'Admin User',
      role: 'owner'
    });
    expect(user.id).toBeDefined();
    expect(user.email).toBe('admin@acme.ai');

    const project = await repo.createProject({
      organizationId: org.id,
      name: 'Production Chatbot',
      slug: 'prod-chatbot',
      description: 'Customer facing chatbot',
      environment: 'production'
    });
    expect(project.id).toBeDefined();

    const rawKey = 'ac_live_test_secret_key_123';
    const hashedKey = createHash('sha256').update(rawKey).digest('hex');

    const key = await repo.createApiKey({
      projectId: project.id,
      keyPrefix: 'ac_live_test...',
      name: 'Default Key',
      hashedKey
    });
    expect(key.id).toBeDefined();

    const foundKey = await repo.getApiKeyByHashedKey(hashedKey);
    expect(foundKey).not.toBeNull();
    expect(foundKey?.projectId).toBe(project.id);
  });

  it('records requests and computes overview metrics correctly', async () => {
    const projects = await repo.listProjects((await repo.getOrganizationBySlug('acme-ai')).id);
    const projectId = projects[0].id;

    // Record sample requests
    await repo.recordRequest({
      requestId: 'req-1',
      projectId,
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      estimatedCost: 0.0075,
      latencyMs: 450,
      statusCode: 200,
      status: 'success',
      timestamp: new Date()
    });

    await repo.recordRequest({
      requestId: 'req-2',
      projectId,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-latest',
      inputTokens: 2000,
      outputTokens: 1000,
      cachedTokens: 1500,
      totalTokens: 3000,
      estimatedCost: 0.021,
      latencyMs: 820,
      statusCode: 200,
      status: 'success',
      timestamp: new Date()
    });

    await repo.recordRequest({
      requestId: 'req-3',
      projectId,
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 500,
      outputTokens: 0,
      totalTokens: 500,
      estimatedCost: 0.00125,
      latencyMs: 210,
      statusCode: 500,
      status: 'error',
      errorMessage: 'Upstream rate limit exceeded',
      timestamp: new Date()
    });

    const metrics = await repo.getOverviewMetrics({ projectId });
    expect(metrics.totalRequests).toBe(3);
    expect(metrics.successfulRequests).toBe(2);
    expect(metrics.failedRequests).toBe(1);
    expect(metrics.totalTokens).toBe(5000);
    expect(metrics.cachedTokens).toBe(1500);
    expect(metrics.errorRate).toBeCloseTo(33.33, 1);
    expect(metrics.totalCost).toBeCloseTo(0.02975, 4);
  });

  it('aggregates spend by provider and model', async () => {
    const projects = await repo.listProjects((await repo.getOrganizationBySlug('acme-ai')).id);
    const projectId = projects[0].id;

    const byProvider = await repo.getSpendByProvider({ projectId });
    expect(byProvider.length).toBe(2); // openai and anthropic
    const openai = byProvider.find(p => p.provider === 'openai');
    const anthropic = byProvider.find(p => p.provider === 'anthropic');
    expect(openai?.requests).toBe(2);
    expect(anthropic?.requests).toBe(1);

    const byModel = await repo.getSpendByModel({ projectId });
    expect(byModel.length).toBe(2);
    const gpt4o = byModel.find(m => m.model === 'gpt-4o');
    expect(gpt4o?.requests).toBe(2);
    expect(gpt4o?.errorRate).toBe(50.0);
  });

  it('manages budgets and triggers threshold warnings', async () => {
    const projects = await repo.listProjects((await repo.getOrganizationBySlug('acme-ai')).id);
    const projectId = projects[0].id;

    // Set a tight budget of $0.03
    const budget = await repo.setBudget({
      projectId,
      monthlyBudgetUsd: 0.03,
      alertThresholdPercent: 75
    });

    expect(budget.monthlyBudgetUsd).toBe(0.03);

    // Current spend is ~0.02975, which is > 75% ($0.0225)
    expect(budget.status).toBe('warning');

    const alerts = await repo.listAlerts(projectId);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].title).toContain('Budget Warning Threshold Reached');
  });

  it('generates cost optimization insights from real data', async () => {
    const projects = await repo.listProjects((await repo.getOrganizationBySlug('acme-ai')).id);
    const projectId = projects[0].id;

    const insights = await repo.getCostInsights({ projectId });
    expect(insights.length).toBeGreaterThan(0);
    const hasCacheInsight = insights.some(i => i.id === 'prompt-caching');
    expect(hasCacheInsight).toBe(true);
  });

  it('inserts multiple requests in a single batch operation', async () => {
    const projects = await repo.listProjects((await repo.getOrganizationBySlug('acme-ai')).id);
    const projectId = projects[0].id;

    await repo.batchRecordRequests([
      {
        requestId: 'batch-req-1',
        projectId,
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.0005,
        latencyMs: 200,
        statusCode: 200,
        status: 'success'
      },
      {
        requestId: 'batch-req-2',
        projectId,
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
        estimatedCost: 0.0015,
        latencyMs: 300,
        statusCode: 200,
        status: 'success'
      }
    ]);

    const res = await repo.listRequests({ projectId, limit: 10 });
    const batchReq1 = res.data.find(r => r.requestId === 'batch-req-1');
    const batchReq2 = res.data.find(r => r.requestId === 'batch-req-2');
    expect(batchReq1).toBeDefined();
    expect(batchReq2).toBeDefined();
    expect(batchReq1?.totalTokens).toBe(150);
    expect(batchReq2?.totalTokens).toBe(300);
  });

  it('rejects startup in production without valid PostgreSQL URL', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      await expect(createDatabaseClient()).rejects.toThrow('DATABASE_URL is required in production environments');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('tracks pricing change history for auditability', async () => {
    await repo.setCustomPricing({
      provider: 'openai',
      model: 'custom-ft-model',
      displayName: 'Fine-tuned Model',
      inputCostPerMillion: 3.50,
      outputCostPerMillion: 12.00
    });

    const history = await repo.getPricingHistory('openai', 'custom-ft-model');
    expect(history.length).toBeGreaterThan(0);
    expect(Number(history[0].input_cost_per_million)).toBe(3.5);
    expect(history[0].source).toBe('custom');
  });

  it('purges old requests using batched chunks', async () => {
    const projects = await repo.listProjects((await repo.getOrganizationBySlug('acme-ai')).id);
    const projectId = projects[0].id;

    // Record an old request from 400 days ago
    await repo.recordRequest({
      requestId: 'ancient-req',
      projectId,
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      estimatedCost: 0.0001,
      latencyMs: 100,
      statusCode: 200,
      status: 'success',
      timestamp: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
    });

    const purged = await repo.purgeOldRequests(365, 5);
    expect(purged).toBeGreaterThanOrEqual(1);
  });
});
