import { z } from 'zod';

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom' | string;

export interface AIRequestUsage {
  id?: string;
  requestId: string;
  projectId: string;
  provider: ProviderType;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
  statusCode: number;
  status: 'success' | 'error';
  errorMessage?: string;
  tags?: Record<string, string>;
  userId?: string;
  environment?: string;
  timestamp: Date;
}

export const AIRequestUsageSchema = z.object({
  id: z.string().optional(),
  requestId: z.string(),
  projectId: z.string(),
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cachedTokens: z.number().int().nonnegative().optional().default(0),
  totalTokens: z.number().int().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  latencyMs: z.number().nonnegative(),
  statusCode: z.number().int().default(200),
  status: z.enum(['success', 'error']),
  errorMessage: z.string().optional(),
  tags: z.record(z.string()).optional(),
  userId: z.string().optional(),
  environment: z.string().optional().default('production'),
  timestamp: z.coerce.date().default(() => new Date()),
});

export interface ModelPricing {
  provider: string;
  model: string;
  displayName: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  cachedInputCostPerMillion?: number;
  isCustom?: boolean;
  description?: string;
  contextWindow?: number;
  effectiveDate?: string;
}

export const ModelPricingSchema = z.object({
  provider: z.string(),
  model: z.string(),
  displayName: z.string(),
  inputCostPerMillion: z.number().nonnegative(),
  outputCostPerMillion: z.number().nonnegative(),
  cachedInputCostPerMillion: z.number().nonnegative().optional(),
  isCustom: z.boolean().optional().default(false),
  description: z.string().optional(),
  contextWindow: z.number().int().optional(),
  effectiveDate: z.string().optional(),
});

export interface CostCalculationResult {
  inputCost: number;
  outputCost: number;
  cachedCost: number;
  totalCost: number;
  pricingFound: boolean;
  pricingSource: 'official' | 'custom' | 'fallback';
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
  createdAt: Date;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  environment: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  projectId: string;
  keyPrefix: string;
  name: string;
  hashedKey: string;
  createdAt: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
}

export interface Budget {
  id: string;
  projectId: string;
  monthlyBudgetUsd: number;
  alertThresholdPercent: number;
  currentSpendUsd: number;
  status: 'ok' | 'warning' | 'exceeded';
  updatedAt: Date;
}

export interface SpendAlert {
  id: string;
  projectId: string;
  type: 'budget_threshold' | 'spend_spike' | 'error_spike' | 'latency_spike';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  triggeredAt: Date;
  resolvedAt?: Date;
}

export interface OverviewMetrics {
  totalCost: number;
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  avgLatencyMs: number;
  errorRate: number;
  successfulRequests: number;
  failedRequests: number;
}

export interface SpendBucket {
  timestamp: string;
  cost: number;
  requests: number;
  tokens: number;
}

export interface ProviderBreakdown {
  provider: string;
  cost: number;
  requests: number;
  tokens: number;
  percentage: number;
}

export interface ModelBreakdown {
  model: string;
  provider: string;
  cost: number;
  requests: number;
  tokens: number;
  avgLatencyMs: number;
  errorRate: number;
}

export interface CostInsight {
  id: string;
  type: 'warning' | 'tip' | 'info';
  title: string;
  message: string;
  potentialSavingsMonthly?: number;
  actionRecommendation?: string;
}

export interface RequestFilter {
  projectId?: string;
  provider?: string;
  model?: string;
  status?: 'success' | 'error';
  environment?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
