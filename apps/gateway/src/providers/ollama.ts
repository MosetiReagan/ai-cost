import { ForwardContext, ProviderResult } from './types.js';

export async function forwardOllama(ctx: ForwardContext): Promise<ProviderResult> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
  const url = `${baseUrl}/v1/chat/completions`;

  let modelName = ctx.model;
  if (modelName.startsWith('ollama/')) {
    modelName = modelName.replace('ollama/', '');
  }

  const payload = {
    ...ctx.body,
    model: modelName
  };

  const isStreaming = ctx.body?.stream === true;
  const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 60_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

    const body: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        statusCode,
        body,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        rawUsageAvailable: false,
        errorMessage: body?.error || `Ollama returned HTTP ${statusCode}`
      };
    }

    const usage = body?.usage;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    return {
      statusCode,
      body,
      inputTokens,
      outputTokens,
      cachedTokens: 0,
      rawUsageAvailable: !!usage
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        statusCode: 504,
        body: { error: { message: `Gateway timed out waiting for Ollama after ${timeoutMs}ms`, type: 'gateway_timeout' } },
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        rawUsageAvailable: false,
        errorMessage: `Upstream timed out after ${timeoutMs}ms`
      };
    }
    return {
      statusCode: 502,
      body: { error: { message: `Gateway failed to reach local Ollama: ${err.message}`, type: 'gateway_error' } },
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
