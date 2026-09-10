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

  const isStreaming = ctx.body?.stream === true;
  const requestBody = { ...ctx.body };
  if (isStreaming && !requestBody.stream_options) {
    requestBody.stream_options = { include_usage: true };
  }

  const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 60_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    const statusCode = res.status;

    if (isStreaming && res.ok && res.body) {
      return {
        statusCode,
        body: null,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        rawUsageAvailable: false,
        isStream: true,
        streamResponse: res
      };
    }

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
    if (err.name === 'AbortError') {
      return {
        statusCode: 504,
        body: { error: { message: `Gateway timed out waiting for OpenAI after ${timeoutMs}ms`, type: 'gateway_timeout' } },
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        rawUsageAvailable: false,
        errorMessage: `Upstream timed out after ${timeoutMs}ms`
      };
    }
    return {
      statusCode: 502,
      body: { error: { message: `Gateway failed to reach OpenAI: ${err.message}`, type: 'gateway_error' } },
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      rawUsageAvailable: false,
      errorMessage: err.message
    };
  } finally {
    clearTimeout(timeout);
  }
}
