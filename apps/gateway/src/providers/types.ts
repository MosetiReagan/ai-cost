export interface ProviderResult {
  statusCode: number;
  body: any;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  rawUsageAvailable: boolean;
  errorMessage?: string;
  isStream?: boolean;
  streamResponse?: Response;
}

export interface ForwardContext {
  model: string;
  body: any;
  providerApiKey?: string;
  requestId: string;
}

export const DEFAULT_UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 60_000);
