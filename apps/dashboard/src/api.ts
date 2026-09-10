import {
  OverviewMetrics,
  SpendBucket,
  ProviderBreakdown,
  ModelBreakdown,
  CostInsight,
  AIRequestItem,
  Project,
  ApiKey,
  Budget,
  SpendAlert,
  ModelPricing
} from './types';

const API_BASE = '/api';

type AuthExpiredCallback = () => void;
const authExpiredListeners = new Set<AuthExpiredCallback>();

export function onAuthExpired(cb: AuthExpiredCallback): () => void {
  authExpiredListeners.add(cb);
  return () => {
    authExpiredListeners.delete(cb);
  };
}

function notifyAuthExpired() {
  authExpiredListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  });
}

/**
 * Checks whether a JWT token string has expired based on its standard exp claim.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Expired if current time + 10s skew exceeds exp timestamp
    return payload.exp * 1000 <= Date.now() + 10000;
  } catch {
    return true;
  }
}

export function getAuthToken(): string | null {
  const token = localStorage.getItem('ai_cost_token');
  if (!token) return null;
  if (isTokenExpired(token)) {
    clearAuthToken();
    notifyAuthExpired();
    return null;
  }
  return token;
}

export function setAuthToken(token: string) {
  localStorage.setItem('ai_cost_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('ai_cost_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearAuthToken();
      notifyAuthExpired();
    }
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  checkStatus: () => request<{ isSetup: boolean }>('/auth/status'),
  setup: (data: any) => request<any>('/auth/setup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  // Projects
  getProjects: () => request<{ projects: Project[] }>('/projects'),
  createProject: (data: { name: string; description?: string }) =>
    request<{ project: Project }>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  deleteProject: (id: string) => request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),

  // Keys
  getKeys: (projectId: string) => request<{ keys: ApiKey[] }>(`/projects/${projectId}/keys`),
  createKey: (projectId: string, name: string) =>
    request<{ apiKey: ApiKey; rawKey: string }>(`/projects/${projectId}/keys`, {
      method: 'POST',
      body: JSON.stringify({ name })
    }),
  revokeKey: (id: string) => request<{ success: boolean }>(`/keys/${id}`, { method: 'DELETE' }),

  // Analytics
  getOverview: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ overview: OverviewMetrics }>(`/analytics/overview${query ? `?${query}` : ''}`);
  },
  getSpendOverTime: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ timeline: SpendBucket[] }>(`/analytics/spend-over-time${query ? `?${query}` : ''}`);
  },
  getSpendByProvider: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ providers: ProviderBreakdown[] }>(`/analytics/by-provider${query ? `?${query}` : ''}`);
  },
  getSpendByModel: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ models: ModelBreakdown[] }>(`/analytics/by-model${query ? `?${query}` : ''}`);
  },
  getInsights: (projectId?: string) => {
    return request<{ insights: CostInsight[] }>(`/analytics/insights${projectId ? `?projectId=${projectId}` : ''}`);
  },

  // Requests
  getRequests: (params: Record<string, string | number | undefined> = {}) => {
    const strParams = Object.entries(params).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== '') acc[k] = String(v);
      return acc;
    }, {} as Record<string, string>);
    const query = new URLSearchParams(strParams).toString();
    return request<{ data: AIRequestItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/requests${query ? `?${query}` : ''}`
    );
  },
  getRequestById: (id: string) => request<{ request: AIRequestItem }>(`/requests/${id}`),

  // Budgets & Alerts
  getBudgets: () => request<{ budgets: Budget[] }>('/budgets'),
  setBudget: (data: { projectId: string; monthlyBudgetUsd: number; alertThresholdPercent?: number }) =>
    request<{ budget: Budget }>('/budgets', { method: 'POST', body: JSON.stringify(data) }),
  getAlerts: () => request<{ alerts: SpendAlert[] }>('/alerts'),
  resolveAlert: (id: string) => request<{ success: boolean }>(`/alerts/${id}/resolve`, { method: 'POST' }),

  // Pricing
  getPricing: () => request<{ official: ModelPricing[]; custom: ModelPricing[] }>('/pricing'),
  addCustomPricing: (data: ModelPricing) =>
    request<{ pricing: ModelPricing }>('/pricing/custom', { method: 'POST', body: JSON.stringify(data) }),
  deleteCustomPricing: (provider: string, model: string) =>
    request<{ success: boolean }>(`/pricing/custom/${provider}/${model}`, { method: 'DELETE' }),

  // Maintenance
  runCleanup: (days: number = 90) =>
    request<{ purged: number; daysRetained: number }>('/admin/cleanup', {
      method: 'POST',
      body: JSON.stringify({ days })
    })
};
