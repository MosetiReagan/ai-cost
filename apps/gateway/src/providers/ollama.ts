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

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
    return {
      statusCode: 502,
      body: { error: { message: `Gateway failed to reach local Ollama: ${err.message}`, type: 'gateway_error' } },
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      rawUsageAvailable: false,
      errorMessage: err.message
    };
  }
}
