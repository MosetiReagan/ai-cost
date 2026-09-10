import { randomUUID } from 'node:crypto';
import {
  AIRequestUsage,
  OverviewMetrics,
  SpendBucket,
  ProviderBreakdown,
  ModelBreakdown,
  CostInsight,
  RequestFilter,
  PaginatedResponse,
  Project,
  ApiKey,
  Budget,
  SpendAlert,
  ModelPricing
} from '@ai-cost/types';
import { IDatabaseClient } from './db.js';

export class Repository {
  constructor(private db: IDatabaseClient) {}

  // --- Organizations & Users ---

  async createOrganization(name: string, slug: string): Promise<{ id: string; name: string; slug: string }> {
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING *`,
      [id, name, slug]
    );
    return { id, name, slug };
  }

  async getOrganizationBySlug(slug: string): Promise<any | null> {
    const res = await this.db.query(`SELECT * FROM organizations WHERE slug = $1`, [slug]);
    return res.rows[0] || null;
  }

  async getOrganizationById(id: string): Promise<any | null> {
    const res = await this.db.query(`SELECT * FROM organizations WHERE id = $1`, [id]);
    return res.rows[0] || null;
  }

  async createUser(data: { organizationId: string; email: string; passwordHash: string; name: string; role?: string }): Promise<any> {
    const id = randomUUID();
    const role = data.role || 'member';
    await this.db.query(
      `INSERT INTO users (id, organization_id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id, organization_id, email, name, role, created_at`,
      [id, data.organizationId, data.email.toLowerCase(), data.passwordHash, data.name, role]
    );
    return { id, organizationId: data.organizationId, email: data.email.toLowerCase(), name: data.name, role };
  }

  async getUserByEmail(email: string): Promise<any | null> {
    const res = await this.db.query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]);
    return res.rows[0] || null;
  }

  async getUserById(id: string): Promise<any | null> {
    const res = await this.db.query(`SELECT id, organization_id, email, name, role, created_at FROM users WHERE id = $1`, [id]);
    return res.rows[0] || null;
  }

  async getUserCount(): Promise<number> {
    const res = await this.db.query(`SELECT COUNT(*)::int as count FROM users`);
    return Number(res.rows[0]?.count || 0);
  }

  // --- Projects ---

  async createProject(data: { organizationId: string; name: string; slug: string; description?: string; environment?: string }): Promise<Project> {
    const id = randomUUID();
    const env = data.environment || 'production';
    const now = new Date();
    await this.db.query(
      `INSERT INTO projects (id, organization_id, name, slug, description, environment, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (organization_id, slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [id, data.organizationId, data.name, data.slug, data.description || null, env, now, now]
    );
    return {
      id,
      organizationId: data.organizationId,
      name: data.name,
      slug: data.slug,
      description: data.description,
      environment: env,
      createdAt: now,
      updatedAt: now
    };
  }

  async listProjects(organizationId: string): Promise<Project[]> {
    const res = await this.db.query<any>(
      `SELECT * FROM projects WHERE organization_id = $1 ORDER BY created_at ASC`,
      [organizationId]
    );
    return res.rows.map(r => ({
      id: r.id,
      organizationId: r.organization_id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      environment: r.environment,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at)
    }));
  }

  async getProjectById(id: string): Promise<Project | null> {
    const res = await this.db.query<any>(`SELECT * FROM projects WHERE id = $1`, [id]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      organizationId: r.organization_id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      environment: r.environment,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at)
    };
  }

  async deleteProject(id: string): Promise<boolean> {
    const res = await this.db.query(`DELETE FROM projects WHERE id = $1`, [id]);
    return (res.rows.length ?? 1) > 0;
  }

  // --- API Keys ---

  async createApiKey(data: { projectId: string; keyPrefix: string; name: string; hashedKey: string }): Promise<ApiKey> {
    const id = randomUUID();
    const now = new Date();
    await this.db.query(
      `INSERT INTO api_keys (id, project_id, key_prefix, name, hashed_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, data.projectId, data.keyPrefix, data.name, data.hashedKey, now]
    );
    return {
      id,
      projectId: data.projectId,
      keyPrefix: data.keyPrefix,
      name: data.name,
      hashedKey: data.hashedKey,
      createdAt: now
    };
  }

  async getApiKeyByHashedKey(hashedKey: string): Promise<(ApiKey & { organizationId: string }) | null> {
    const res = await this.db.query<any>(
      `SELECT k.*, p.organization_id
       FROM api_keys k
       JOIN projects p ON k.project_id = p.id
       WHERE k.hashed_key = $1 AND k.revoked_at IS NULL`,
      [hashedKey]
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      projectId: r.project_id,
      keyPrefix: r.key_prefix,
      name: r.name,
      hashedKey: r.hashed_key,
      createdAt: new Date(r.created_at),
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : undefined,
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : undefined,
      organizationId: r.organization_id
    };
  }

  async getApiKeyById(id: string): Promise<(ApiKey & { organizationId: string }) | null> {
    const res = await this.db.query<any>(
      `SELECT k.*, p.organization_id
       FROM api_keys k
       JOIN projects p ON k.project_id = p.id
       WHERE k.id = $1`,
      [id]
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      projectId: r.project_id,
      keyPrefix: r.key_prefix,
      name: r.name,
      hashedKey: r.hashed_key,
      createdAt: new Date(r.created_at),
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : undefined,
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : undefined,
      organizationId: r.organization_id
    };
  }

  async listApiKeys(projectId: string): Promise<ApiKey[]> {
    const res = await this.db.query<any>(
      `SELECT id, project_id, key_prefix, name, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );
    return res.rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      keyPrefix: r.key_prefix,
      name: r.name,
      hashedKey: '***',
      createdAt: new Date(r.created_at),
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : undefined,
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : undefined
    }));
  }

  async revokeApiKey(id: string): Promise<boolean> {
    await this.db.query(`UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    return true;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await this.db.query(`UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
  }

  // --- Requests & Usage Tracking ---

  async recordRequest(usage: AIRequestUsage): Promise<string> {
    const id = usage.id || randomUUID();
    const tagsJson = usage.tags ? JSON.stringify(usage.tags) : null;
    const ts = usage.timestamp || new Date();

    await this.db.query(
      `INSERT INTO requests (
        id, request_id, project_id, provider, model,
        input_tokens, output_tokens, cached_tokens, total_tokens,
        estimated_cost, latency_ms, status_code, status,
        error_message, tags, user_id, environment, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        id,
        usage.requestId,
        usage.projectId,
        usage.provider.toLowerCase(),
        usage.model.toLowerCase(),
        usage.inputTokens,
        usage.outputTokens,
        usage.cachedTokens || 0,
        usage.totalTokens,
        usage.estimatedCost,
        usage.latencyMs,
        usage.statusCode || 200,
        usage.status,
        usage.errorMessage || null,
        tagsJson,
        usage.userId || null,
        usage.environment || 'production',
        ts
      ]
    );

    // Update budget spend
    try {
      await this.checkAndUpdateBudget(usage.projectId, usage.estimatedCost);
    } catch (err) {
      console.error('[ai-cost/database] Failed to update budget:', err);
    }

    return id;
  }

  async batchRecordRequests(usages: AIRequestUsage[]): Promise<void> {
    if (usages.length === 0) return;

    const values: unknown[] = [];
    const rowPlaceholders: string[] = [];
    let pIdx = 1;

    for (const u of usages) {
      const id = u.id || randomUUID();
      const tagsJson = u.tags ? JSON.stringify(u.tags) : null;
      const ts = u.timestamp || new Date();

      rowPlaceholders.push(
        `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`
      );

      values.push(
        id,
        u.requestId,
        u.projectId,
        u.provider.toLowerCase(),
        u.model.toLowerCase(),
        u.inputTokens,
        u.outputTokens,
        u.cachedTokens || 0,
        u.totalTokens,
        u.estimatedCost,
        u.latencyMs,
        u.statusCode || 200,
        u.status,
        u.errorMessage || null,
        tagsJson,
        u.userId || null,
        u.environment || 'production',
        ts
      );
    }

    const sql = `INSERT INTO requests (
      id, request_id, project_id, provider, model,
      input_tokens, output_tokens, cached_tokens, total_tokens,
      estimated_cost, latency_ms, status_code, status,
      error_message, tags, user_id, environment, timestamp
    ) VALUES ${rowPlaceholders.join(', ')}`;

    await this.db.query(sql, values);

    // Update budgets grouped by project
    const spendByProject = new Map<string, number>();
    for (const u of usages) {
      spendByProject.set(u.projectId, (spendByProject.get(u.projectId) ?? 0) + u.estimatedCost);
    }

    for (const [projectId, incrementalCost] of spendByProject.entries()) {
      try {
        await this.checkAndUpdateBudget(projectId, incrementalCost);
      } catch (err) {
        console.error('[ai-cost/database] Failed to update budget in batch:', err);
      }
    }
  }

  async listRequests(filter: RequestFilter): Promise<PaginatedResponse<AIRequestUsage>> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filter.projectId) {
      conditions.push(`project_id = $${pIdx++}`);
      params.push(filter.projectId);
    } else if ((filter as any).projectIds && (filter as any).projectIds.length > 0) {
      const placeholders = (filter as any).projectIds.map(() => `$${pIdx++}`).join(', ');
      conditions.push(`project_id IN (${placeholders})`);
      params.push(...(filter as any).projectIds);
    }
    if (filter.provider) {
      conditions.push(`provider = $${pIdx++}`);
      params.push(filter.provider.toLowerCase());
    }
    if (filter.model) {
      conditions.push(`model LIKE $${pIdx++}`);
      params.push(`%${filter.model.toLowerCase()}%`);
    }
    if (filter.status) {
      conditions.push(`status = $${pIdx++}`);
      params.push(filter.status);
    }
    if (filter.environment) {
      conditions.push(`environment = $${pIdx++}`);
      params.push(filter.environment);
    }
    if (filter.startDate) {
      conditions.push(`timestamp >= $${pIdx++}`);
      params.push(new Date(filter.startDate));
    }
    if (filter.endDate) {
      conditions.push(`timestamp <= $${pIdx++}`);
      params.push(new Date(filter.endDate));
    }
    if (filter.search) {
      conditions.push(`(request_id LIKE $${pIdx} OR model LIKE $${pIdx} OR error_message LIKE $${pIdx})`);
      params.push(`%${filter.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int as total FROM requests ${whereClause}`,
      params
    );
    const total = Number(countRes.rows[0]?.total || 0);

    const dataRes = await this.db.query<any>(
      `SELECT * FROM requests ${whereClause} ORDER BY timestamp DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...params, limit, offset]
    );

    const data: AIRequestUsage[] = dataRes.rows.map(r => ({
      id: r.id,
      requestId: r.request_id,
      projectId: r.project_id,
      provider: r.provider,
      model: r.model,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      cachedTokens: r.cached_tokens,
      totalTokens: r.total_tokens,
      estimatedCost: Number(r.estimated_cost),
      latencyMs: r.latency_ms,
      statusCode: r.status_code,
      status: r.status as 'success' | 'error',
      errorMessage: r.error_message || undefined,
      tags: r.tags ? JSON.parse(r.tags) : undefined,
      userId: r.user_id || undefined,
      environment: r.environment,
      timestamp: new Date(r.timestamp)
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  async getRequestById(id: string): Promise<AIRequestUsage | null> {
    const res = await this.db.query<any>(`SELECT * FROM requests WHERE id = $1 OR request_id = $1`, [id]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      requestId: r.request_id,
      projectId: r.project_id,
      provider: r.provider,
      model: r.model,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      cachedTokens: r.cached_tokens,
      totalTokens: r.total_tokens,
      estimatedCost: Number(r.estimated_cost),
      latencyMs: r.latency_ms,
      statusCode: r.status_code,
      status: r.status as 'success' | 'error',
      errorMessage: r.error_message || undefined,
      tags: r.tags ? JSON.parse(r.tags) : undefined,
      userId: r.user_id || undefined,
      environment: r.environment,
      timestamp: new Date(r.timestamp)
    };
  }

  // --- Analytics Aggregations ---

  private buildFilterClauses(filter: { projectId?: string; projectIds?: string[]; startDate?: Date; endDate?: Date; provider?: string; model?: string }, startIdx: number = 1) {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = startIdx;

    if (filter.projectId) {
      conditions.push(`project_id = $${pIdx++}`);
      params.push(filter.projectId);
    } else if (filter.projectIds && filter.projectIds.length > 0) {
      const placeholders = filter.projectIds.map(() => `$${pIdx++}`).join(', ');
      conditions.push(`project_id IN (${placeholders})`);
      params.push(...filter.projectIds);
    }
    if (filter.provider) {
      conditions.push(`provider = $${pIdx++}`);
      params.push(filter.provider.toLowerCase());
    }
    if (filter.model) {
      conditions.push(`model = $${pIdx++}`);
      params.push(filter.model.toLowerCase());
    }
    if (filter.startDate) {
      conditions.push(`timestamp >= $${pIdx++}`);
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push(`timestamp <= $${pIdx++}`);
      params.push(filter.endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { where, params };
  }

  async getOverviewMetrics(filter: { projectId?: string; startDate?: Date; endDate?: Date; provider?: string; model?: string }): Promise<OverviewMetrics> {
    const { where, params } = this.buildFilterClauses(filter);

    const sql = `
      SELECT
        COALESCE(SUM(estimated_cost), 0)::float as total_cost,
        COUNT(*)::int as total_requests,
        COALESCE(SUM(total_tokens), 0)::bigint as total_tokens,
        COALESCE(SUM(input_tokens), 0)::bigint as input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint as output_tokens,
        COALESCE(SUM(cached_tokens), 0)::bigint as cached_tokens,
        COALESCE(AVG(latency_ms), 0)::float as avg_latency_ms,
        COUNT(CASE WHEN status = 'success' THEN 1 END)::int as successful_requests,
        COUNT(CASE WHEN status = 'error' THEN 1 END)::int as failed_requests
      FROM requests
      ${where}
    `;

    const res = await this.db.query<any>(sql, params);
    const row = res.rows[0] || {};
    const totalRequests = Number(row.total_requests || 0);
    const failedRequests = Number(row.failed_requests || 0);
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0.0;

    return {
      totalCost: Number(Number(row.total_cost || 0).toFixed(6)),
      totalRequests,
      totalTokens: Number(row.total_tokens || 0),
      inputTokens: Number(row.input_tokens || 0),
      outputTokens: Number(row.output_tokens || 0),
      cachedTokens: Number(row.cached_tokens || 0),
      avgLatencyMs: Math.round(Number(row.avg_latency_ms || 0)),
      errorRate: Number(errorRate.toFixed(2)),
      successfulRequests: Number(row.successful_requests || 0),
      failedRequests
    };
  }

  async getSpendOverTime(filter: { projectId?: string; projectIds?: string[]; startDate?: Date; endDate?: Date; interval?: 'hour' | 'day' }): Promise<SpendBucket[]> {
    const interval: 'hour' | 'day' = filter.interval === 'hour' ? 'hour' : 'day';
    const { where, params } = this.buildFilterClauses(filter, 2);

    const sql = `
      SELECT
        TO_CHAR(DATE_TRUNC($1, timestamp), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as bucket,
        COALESCE(SUM(estimated_cost), 0)::float as cost,
        COUNT(*)::int as requests,
        COALESCE(SUM(total_tokens), 0)::bigint as tokens
      FROM requests
      ${where}
      GROUP BY DATE_TRUNC($1, timestamp)
      ORDER BY DATE_TRUNC($1, timestamp) ASC
    `;

    const res = await this.db.query<any>(sql, [interval, ...params]);
    return res.rows.map(r => ({
      timestamp: r.bucket,
      cost: Number(Number(r.cost).toFixed(4)),
      requests: Number(r.requests),
      tokens: Number(r.tokens)
    }));
  }

  async getSpendByProvider(filter: { projectId?: string; startDate?: Date; endDate?: Date }): Promise<ProviderBreakdown[]> {
    const { where, params } = this.buildFilterClauses(filter);

    const sql = `
      SELECT
        provider,
        COALESCE(SUM(estimated_cost), 0)::float as cost,
        COUNT(*)::int as requests,
        COALESCE(SUM(total_tokens), 0)::bigint as tokens
      FROM requests
      ${where}
      GROUP BY provider
      ORDER BY cost DESC
    `;

    const res = await this.db.query<any>(sql, params);
    const totalCost = res.rows.reduce((sum, r) => sum + Number(r.cost), 0);

    return res.rows.map(r => {
      const cost = Number(Number(r.cost).toFixed(4));
      const percentage = totalCost > 0 ? Number(((cost / totalCost) * 100).toFixed(1)) : 0;
      return {
        provider: r.provider,
        cost,
        requests: Number(r.requests),
        tokens: Number(r.tokens),
        percentage
      };
    });
  }

  async getSpendByModel(filter: { projectId?: string; startDate?: Date; endDate?: Date }): Promise<ModelBreakdown[]> {
    const { where, params } = this.buildFilterClauses(filter);

    const sql = `
      SELECT
        model,
        provider,
        COALESCE(SUM(estimated_cost), 0)::float as cost,
        COUNT(*)::int as requests,
        COALESCE(SUM(total_tokens), 0)::bigint as tokens,
        COALESCE(AVG(latency_ms), 0)::float as avg_latency_ms,
        COUNT(CASE WHEN status = 'error' THEN 1 END)::int as failed_requests
      FROM requests
      ${where}
      GROUP BY model, provider
      ORDER BY cost DESC
    `;

    const res = await this.db.query<any>(sql, params);
    return res.rows.map(r => {
      const requests = Number(r.requests);
      const failed = Number(r.failed_requests);
      const errorRate = requests > 0 ? Number(((failed / requests) * 100).toFixed(1)) : 0;
      return {
        model: r.model,
        provider: r.provider,
        cost: Number(Number(r.cost).toFixed(4)),
        requests,
        tokens: Number(r.tokens),
        avgLatencyMs: Math.round(Number(r.avg_latency_ms)),
        errorRate
      };
    });
  }

  async getCostInsights(filter: { projectId?: string; projectIds?: string[] }): Promise<CostInsight[]> {
    const insights: CostInsight[] = [];
    const overview = await this.getOverviewMetrics(filter);
    const models = await this.getSpendByModel(filter);

    if (overview.totalRequests === 0) {
      return [
        {
          id: 'welcome',
          type: 'info',
          title: 'Start Sending AI Traffic',
          message: 'Route requests through the AI Cost Gateway or use the SDK to generate live cost and performance insights.',
          actionRecommendation: 'Point your OPENAI_BASE_URL to http://localhost:4000/v1'
        }
      ];
    }

    if (models.length > 0 && overview.totalCost > 0) {
      const topModel = models[0];
      const modelShare = (topModel.cost / overview.totalCost) * 100;
      if (modelShare >= 50 && models.length > 1) {
        insights.push({
          id: 'model-dominance',
          type: 'warning',
          title: `Model ${topModel.model} accounts for ${modelShare.toFixed(0)}% of total spend`,
          message: `${topModel.model} is responsible for $${topModel.cost.toFixed(2)} of your $${overview.totalCost.toFixed(2)} total spend.`,
          potentialSavingsMonthly: Number((topModel.cost * 0.35).toFixed(2)),
          actionRecommendation: `Evaluate if lighter tasks handled by ${topModel.model} can be routed to a smaller model (e.g. gpt-4o-mini, claude-3-5-haiku, or gemini-1.5-flash).`
        });
      }
    }

    const expensiveModels = models.filter(m => m.model.includes('opus') || m.model.includes('o1') || m.model.includes('gpt-4-turbo'));
    const expensiveSpend = expensiveModels.reduce((acc, m) => acc + m.cost, 0);
    if (expensiveSpend > 0 && overview.totalCost > 0) {
      const expShare = (expensiveSpend / overview.totalCost) * 100;
      if (expShare > 30) {
        insights.push({
          id: 'expensive-reasoning',
          type: 'warning',
          title: `${expShare.toFixed(0)}% of requests use high-cost reasoning models`,
          message: `Heavy reasoning models (${expensiveModels.map(m => m.model).join(', ')}) account for significant spend.`,
          potentialSavingsMonthly: Number((expensiveSpend * 0.5).toFixed(2)),
          actionRecommendation: 'Tier simple extraction or classification prompts down to cheaper models.'
        });
      }
    }

    if (overview.errorRate >= 5.0) {
      insights.push({
        id: 'high-error-rate',
        type: 'warning',
        title: `Elevated error rate (${overview.errorRate.toFixed(1)}%)`,
        message: `${overview.failedRequests} out of ${overview.totalRequests} requests resulted in errors. Check downstream provider rate limits or bad request payloads.`,
        actionRecommendation: 'Inspect the Request Explorer filtered by status="error" to identify failure patterns.'
      });
    }

    if (overview.cachedTokens > 0) {
      const cacheSavings = (overview.cachedTokens / 1_000_000) * 2.5;
      insights.push({
        id: 'prompt-caching',
        type: 'tip',
        title: 'Prompt Caching is active',
        message: `${overview.cachedTokens.toLocaleString()} input tokens were served from cache, saving approximately $${cacheSavings.toFixed(2)}.`,
        actionRecommendation: 'Keep static system prompts at the beginning of message histories to maximize cache hits.'
      });
    } else if (overview.totalTokens > 500_000) {
      insights.push({
        id: 'enable-caching',
        type: 'tip',
        title: 'Potential Prompt Caching opportunity',
        message: 'No prompt cache hits detected. Anthropic and OpenAI support prompt caching for long repetitive system instructions.',
        actionRecommendation: 'Structure reusable context at the start of prompts to cut input token costs up to 90%.'
      });
    }

    return insights;
  }

  // --- Budgets & Alerts ---

  async setBudget(data: { projectId: string; monthlyBudgetUsd: number; alertThresholdPercent?: number }): Promise<Budget> {
    const id = randomUUID();
    const threshold = data.alertThresholdPercent || 80;
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const res = await this.db.query<any>(
      `SELECT COALESCE(SUM(estimated_cost), 0)::float as spend FROM requests WHERE project_id = $1 AND timestamp >= $2`,
      [data.projectId, startOfMonth]
    );
    const currentSpend = Number(res.rows[0]?.spend || 0);
    const percentUsed = data.monthlyBudgetUsd > 0 ? (currentSpend / data.monthlyBudgetUsd) * 100 : 0;
    const status = percentUsed >= 100 ? 'exceeded' : percentUsed >= threshold ? 'warning' : 'ok';

    await this.db.query(
      `INSERT INTO budgets (id, project_id, monthly_budget_usd, alert_threshold_percent, current_spend_usd, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (project_id) DO UPDATE SET
         monthly_budget_usd = EXCLUDED.monthly_budget_usd,
         alert_threshold_percent = EXCLUDED.alert_threshold_percent,
         current_spend_usd = EXCLUDED.current_spend_usd,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [id, data.projectId, data.monthlyBudgetUsd, threshold, currentSpend, status, now]
    );

    // Create alert immediately if threshold is already met or exceeded
    if (status !== 'ok') {
      await this.createAlert({
        projectId: data.projectId,
        type: 'budget_threshold',
        severity: status === 'exceeded' ? 'critical' : 'warning',
        title: status === 'exceeded' ? 'Monthly Budget Exceeded' : 'Budget Warning Threshold Reached',
        message: `Project spend is currently $${currentSpend.toFixed(2)} of $${data.monthlyBudgetUsd.toFixed(2)} (${percentUsed.toFixed(1)}%).`,
        metadata: { currentSpend, monthlyBudget: data.monthlyBudgetUsd, percentUsed }
      });
    }

    return {
      id,
      projectId: data.projectId,
      monthlyBudgetUsd: data.monthlyBudgetUsd,
      alertThresholdPercent: threshold,
      currentSpendUsd: Number(currentSpend.toFixed(2)),
      status,
      updatedAt: now
    };
  }

  async getBudget(projectId: string): Promise<Budget | null> {
    const res = await this.db.query<any>(`SELECT * FROM budgets WHERE project_id = $1`, [projectId]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      projectId: r.project_id,
      monthlyBudgetUsd: Number(r.monthly_budget_usd),
      alertThresholdPercent: Number(r.alert_threshold_percent),
      currentSpendUsd: Number(Number(r.current_spend_usd).toFixed(2)),
      status: r.status as any,
      updatedAt: new Date(r.updated_at)
    };
  }

  async listBudgets(organizationId?: string): Promise<(Budget & { projectName: string })[]> {
    let sql = `
      SELECT b.*, p.name as project_name
      FROM budgets b
      JOIN projects p ON b.project_id = p.id
    `;
    const params: any[] = [];
    if (organizationId) {
      sql += ` WHERE p.organization_id = $1`;
      params.push(organizationId);
    }
    sql += ` ORDER BY b.updated_at DESC`;

    const res = await this.db.query<any>(sql, params);
    return res.rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.project_name,
      monthlyBudgetUsd: Number(r.monthly_budget_usd),
      alertThresholdPercent: Number(r.alert_threshold_percent),
      currentSpendUsd: Number(Number(r.current_spend_usd).toFixed(2)),
      status: r.status as any,
      updatedAt: new Date(r.updated_at)
    }));
  }

  private async checkAndUpdateBudget(projectId: string, incrementalCost: number): Promise<void> {
    const budget = await this.getBudget(projectId);
    if (!budget) return;

    const newSpend = budget.currentSpendUsd + incrementalCost;
    const percentUsed = budget.monthlyBudgetUsd > 0 ? (newSpend / budget.monthlyBudgetUsd) * 100 : 0;
    const newStatus = percentUsed >= 100 ? 'exceeded' : percentUsed >= budget.alertThresholdPercent ? 'warning' : 'ok';

    await this.db.query(
      `UPDATE budgets SET current_spend_usd = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE project_id = $3`,
      [newSpend, newStatus, projectId]
    );

    if (newStatus !== budget.status && newStatus !== 'ok') {
      await this.createAlert({
        projectId,
        type: 'budget_threshold',
        severity: newStatus === 'exceeded' ? 'critical' : 'warning',
        title: newStatus === 'exceeded' ? 'Monthly Budget Exceeded' : 'Budget Warning Threshold Reached',
        message: `Project spend is currently $${newSpend.toFixed(2)} of $${budget.monthlyBudgetUsd.toFixed(2)} (${percentUsed.toFixed(1)}%).`,
        metadata: { currentSpend: newSpend, monthlyBudget: budget.monthlyBudgetUsd, percentUsed }
      });
    }
  }

  async createAlert(data: { projectId: string; type: string; severity?: string; title: string; message: string; metadata?: any }): Promise<SpendAlert> {
    const id = randomUUID();
    const now = new Date();
    await this.db.query(
      `INSERT INTO alerts (id, project_id, type, severity, title, message, metadata, triggered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, data.projectId, data.type, data.severity || 'info', data.title, data.message, data.metadata ? JSON.stringify(data.metadata) : null, now]
    );
    return {
      id,
      projectId: data.projectId,
      type: data.type as any,
      severity: (data.severity || 'info') as any,
      title: data.title,
      message: data.message,
      metadata: data.metadata,
      triggeredAt: now
    };
  }

  async getAlertById(id: string): Promise<(SpendAlert & { organizationId: string }) | null> {
    const res = await this.db.query<any>(
      `SELECT a.*, p.organization_id
       FROM alerts a
       JOIN projects p ON a.project_id = p.id
       WHERE a.id = $1`,
      [id]
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      projectId: r.project_id,
      organizationId: r.organization_id,
      type: r.type,
      severity: r.severity,
      title: r.title,
      message: r.message,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      triggeredAt: new Date(r.triggered_at),
      resolvedAt: r.resolved_at ? new Date(r.resolved_at) : undefined
    };
  }

  async listAlerts(projectId?: string, resolved: boolean = false, organizationId?: string): Promise<SpendAlert[]> {
    let sql = `
      SELECT a.*
      FROM alerts a
      JOIN projects p ON a.project_id = p.id
      WHERE ${resolved ? 'a.resolved_at IS NOT NULL' : 'a.resolved_at IS NULL'}
    `;
    const params: any[] = [];
    let pIdx = 1;
    if (organizationId) {
      sql += ` AND p.organization_id = $${pIdx++}`;
      params.push(organizationId);
    }
    if (projectId) {
      sql += ` AND a.project_id = $${pIdx++}`;
      params.push(projectId);
    }
    sql += ` ORDER BY a.triggered_at DESC LIMIT 50`;

    const res = await this.db.query<any>(sql, params);
    return res.rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      type: r.type,
      severity: r.severity,
      title: r.title,
      message: r.message,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      triggeredAt: new Date(r.triggered_at),
      resolvedAt: r.resolved_at ? new Date(r.resolved_at) : undefined
    }));
  }

  async resolveAlert(id: string): Promise<boolean> {
    await this.db.query(`UPDATE alerts SET resolved_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    return true;
  }

  // --- Custom Pricing ---

  async setCustomPricing(pricing: ModelPricing): Promise<void> {
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO custom_pricing (id, provider, model, display_name, input_cost_per_million, output_cost_per_million, cached_input_cost_per_million)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (provider, model) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         input_cost_per_million = EXCLUDED.input_cost_per_million,
         output_cost_per_million = EXCLUDED.output_cost_per_million,
         cached_input_cost_per_million = EXCLUDED.cached_input_cost_per_million`,
      [
        id,
        pricing.provider.toLowerCase(),
        pricing.model.toLowerCase(),
        pricing.displayName,
        pricing.inputCostPerMillion,
        pricing.outputCostPerMillion,
        pricing.cachedInputCostPerMillion || null
      ]
    );
  }

  async listCustomPricing(): Promise<ModelPricing[]> {
    const res = await this.db.query<any>(`SELECT * FROM custom_pricing ORDER BY provider, model`);
    return res.rows.map(r => ({
      provider: r.provider,
      model: r.model,
      displayName: r.display_name,
      inputCostPerMillion: Number(r.input_cost_per_million),
      outputCostPerMillion: Number(r.output_cost_per_million),
      cachedInputCostPerMillion: r.cached_input_cost_per_million ? Number(r.cached_input_cost_per_million) : undefined,
      isCustom: true
    }));
  }

  async deleteCustomPricing(provider: string, model: string): Promise<boolean> {
    await this.db.query(`DELETE FROM custom_pricing WHERE provider = $1 AND model = $2`, [provider.toLowerCase(), model.toLowerCase()]);
    return true;
  }

  // --- Retention & Cleanup ---

  async purgeOldRequests(daysToKeep: number): Promise<number> {
    if (daysToKeep <= 0) return 0;
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const res = await this.db.query(`DELETE FROM requests WHERE timestamp < $1`, [cutoff]);
    return res.rows.length;
  }
}
