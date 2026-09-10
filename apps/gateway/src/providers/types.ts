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
