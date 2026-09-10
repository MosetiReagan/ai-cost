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

export interface AIRequestItem {
  id: string;
  requestId: string;
  projectId: string;
  provider: string;
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
  environment?: string;
  timestamp: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  environment: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  projectId: string;
  keyPrefix: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface Budget {
  id: string;
  projectId: string;
  projectName?: string;
  monthlyBudgetUsd: number;
  alertThresholdPercent: number;
  currentSpendUsd: number;
  status: 'ok' | 'warning' | 'exceeded';
  updatedAt: string;
}

export interface SpendAlert {
  id: string;
  projectId: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  triggeredAt: string;
  resolvedAt?: string;
}

export interface ModelPricing {
  provider: string;
  model: string;
  displayName: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  cachedInputCostPerMillion?: number;
  isCustom?: boolean;
  description?: string;
}
