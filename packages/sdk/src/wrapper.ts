import { AICost } from './client.js';

/**
 * Wraps an OpenAI client instance to automatically record latency and token counts.
 */
export function wrapOpenAI<T extends { chat?: { completions?: { create?: (...args: any[]) => any } } }>(
  client: T,
  aiCost: AICost
): T {
  if (!client?.chat?.completions?.create) {
    return client;
  }

  const originalCreate = client.chat.completions.create.bind(client.chat.completions);

  client.chat.completions.create = async function (params: any, options: any) {
    const start = Date.now();
    try {
      const response = await originalCreate(params, options);
      const latencyMs = Date.now() - start;

      // Extract usage from standard OpenAI chat completion response
      if (response && response.usage) {
        aiCost.track({
          provider: 'openai',
          model: response.model || params.model,
          inputTokens: response.usage.prompt_tokens || 0,
          outputTokens: response.usage.completion_tokens || 0,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
          latencyMs,
          statusCode: 200,
          status: 'success'
        }).catch(() => {});
      }

      return response;
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      aiCost.track({
        provider: 'openai',
        model: params.model,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        statusCode: err.status || 500,
        status: 'error',
        errorMessage: err.message
      }).catch(() => {});
      throw err;
    }
  };

  return client;
}

/**
 * Wraps an Anthropic client instance to automatically record latency and token counts.
 */
export function wrapAnthropic<T extends { messages?: { create?: (...args: any[]) => any } }>(
  client: T,
  aiCost: AICost
): T {
  if (!client?.messages?.create) {
    return client;
  }

  const originalCreate = client.messages.create.bind(client.messages);

  client.messages.create = async function (params: any, options: any) {
    const start = Date.now();
    try {
      const response = await originalCreate(params, options);
      const latencyMs = Date.now() - start;

      if (response && response.usage) {
        aiCost.track({
          provider: 'anthropic',
          model: response.model || params.model,
          inputTokens: response.usage.input_tokens || 0,
          outputTokens: response.usage.output_tokens || 0,
          cachedTokens: response.usage.cache_read_input_tokens || 0,
          latencyMs,
          statusCode: 200,
          status: 'success'
        }).catch(() => {});
      }

      return response;
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      aiCost.track({
        provider: 'anthropic',
        model: params.model,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        statusCode: err.status || 500,
        status: 'error',
        errorMessage: err.message
      }).catch(() => {});
      throw err;
    }
  };

  return client;
}
