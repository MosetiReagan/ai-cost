import { ForwardContext, ProviderResult } from './types.js';

export async function forwardOpenAI(ctx: ForwardContext): Promise<ProviderResult> {
  const apiKey = ctx.providerApiKey || process.env.OPENAI_API_KEY || '';
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(ctx.body)
    });

    const statusCode = res.status;
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        statusCode,
        body,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        rawUsageAvailable: false,
        errorMessage: (body as any)?.error?.message || `Upstream OpenAI returned HTTP ${statusCode}`
      };
    }

    const usage = (body as any)?.usage;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;

    return {
      statusCode,
      body,
      inputTokens,
      outputTokens,
      cachedTokens,
      rawUsageAvailable: !!usage
    };
  } catch (err: any) {
    return {
      statusCode: 502,
      body: { error: { message: `Gateway failed to reach OpenAI: ${err.message}`, type: 'gateway_error' } },
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      rawUsageAvailable: false,
      errorMessage: err.message
    };
  }
}
