import { AICost } from './client.js';

export const WRAPPED_MARKER = Symbol('__AI_COST_WRAPPED__');

async function* wrapOpenAIStream(
  stream: AsyncIterable<any>,
  params: any,
  start: number,
  aiCost: AICost
) {
  let model = params?.model || 'unknown';
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let hasUsage = false;
  let outputText = '';
  let errorOccurred = false;

  try {
    for await (const chunk of stream) {
      if (chunk.model) {
        model = chunk.model;
      }
      if (chunk.usage) {
        hasUsage = true;
        inputTokens = chunk.usage.prompt_tokens || inputTokens;
        outputTokens = chunk.usage.completion_tokens || outputTokens;
        cachedTokens = chunk.usage.prompt_tokens_details?.cached_tokens || cachedTokens;
      }
      if (!hasUsage) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') {
          outputText += delta;
        }
      }
      yield chunk;
    }
  } catch (err: any) {
    errorOccurred = true;
    const latencyMs = Date.now() - start;
    aiCost.track({
      provider: 'openai',
      model,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      statusCode: err.status || 500,
      status: 'error',
      errorMessage: err.message
    }).catch(() => {});
    throw err;
  }

  if (!errorOccurred) {
    const latencyMs = Date.now() - start;
    if (!hasUsage && outputText.length > 0) {
      outputTokens = Math.ceil(outputText.length / 4);
    }
    aiCost.track({
      provider: 'openai',
      model,
      inputTokens,
      outputTokens,
      cachedTokens,
      latencyMs,
      statusCode: 200,
      status: 'success'
    }).catch(() => {});
  }
}

function createWrappedOpenAICreate(originalCreate: (...args: any[]) => any, aiCost: AICost) {
  return async function (params: any, options: any) {
    const start = Date.now();
    try {
      const response = await originalCreate(params, options);

      // Handle streaming async iterables
      if (response != null && typeof (response as any)[Symbol.asyncIterator] === 'function') {
        return wrapOpenAIStream(response, params, start, aiCost);
      }

      const latencyMs = Date.now() - start;

      // Extract usage from standard OpenAI chat completion response
      if (response && response.usage) {
        aiCost.track({
          provider: 'openai',
          model: response.model || params?.model || 'unknown',
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
        model: params?.model || 'unknown',
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
}

function wrapOpenAIChat(chat: any, aiCost: AICost): any {
  return new Proxy(chat, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === 'completions' && value && typeof value === 'object') {
        return wrapOpenAICompletions(value, aiCost);
      }
      return value;
    }
  });
}

function wrapOpenAICompletions(completions: any, aiCost: AICost): any {
  return new Proxy(completions, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === 'create' && typeof value === 'function') {
        return createWrappedOpenAICreate(value.bind(target), aiCost);
      }
      return value;
    }
  });
}

/**
 * Wraps an OpenAI client instance via Proxy to automatically record latency and token counts without mutating original client.
 */
export function wrapOpenAI<T extends object>(
  client: T,
  aiCost: AICost
): T {
  if (!client || (client as any)[WRAPPED_MARKER]) {
    return client;
  }

  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      if (prop === WRAPPED_MARKER) {
        return true;
      }
      const value = Reflect.get(target, prop, receiver);
      if (prop === 'chat' && value && typeof value === 'object') {
        return wrapOpenAIChat(value, aiCost);
      }
      return value;
    }
  };

  return new Proxy(client, handler);
}

async function* wrapAnthropicStream(
  stream: AsyncIterable<any>,
  params: any,
  start: number,
  aiCost: AICost
) {
  let model = params?.model || 'unknown';
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let errorOccurred = false;

  try {
    for await (const chunk of stream) {
      if (chunk.type === 'message_start' && chunk.message) {
        if (chunk.message.model) model = chunk.message.model;
        if (chunk.message.usage) {
          inputTokens = chunk.message.usage.input_tokens || inputTokens;
          cachedTokens = chunk.message.usage.cache_read_input_tokens || cachedTokens;
        }
      } else if (chunk.type === 'message_delta' && chunk.usage) {
        outputTokens = chunk.usage.output_tokens || outputTokens;
      }
      yield chunk;
    }
  } catch (err: any) {
    errorOccurred = true;
    const latencyMs = Date.now() - start;
    aiCost.track({
      provider: 'anthropic',
      model,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      statusCode: err.status || 500,
      status: 'error',
      errorMessage: err.message
    }).catch(() => {});
    throw err;
  }

  if (!errorOccurred) {
    const latencyMs = Date.now() - start;
    aiCost.track({
      provider: 'anthropic',
      model,
      inputTokens,
      outputTokens,
      cachedTokens,
      latencyMs,
      statusCode: 200,
      status: 'success'
    }).catch(() => {});
  }
}

function createWrappedAnthropicCreate(originalCreate: (...args: any[]) => any, aiCost: AICost) {
  return async function (params: any, options: any) {
    const start = Date.now();
    try {
      const response = await originalCreate(params, options);

      // Handle streaming async iterables
      if (response != null && typeof (response as any)[Symbol.asyncIterator] === 'function') {
        return wrapAnthropicStream(response, params, start, aiCost);
      }

      const latencyMs = Date.now() - start;

      if (response && response.usage) {
        aiCost.track({
          provider: 'anthropic',
          model: response.model || params?.model || 'unknown',
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
        model: params?.model || 'unknown',
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
}

function wrapAnthropicMessages(messages: any, aiCost: AICost): any {
  return new Proxy(messages, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === 'create' && typeof value === 'function') {
        return createWrappedAnthropicCreate(value.bind(target), aiCost);
      }
      return value;
    }
  });
}

/**
 * Wraps an Anthropic client instance via Proxy to automatically record latency and token counts without mutating original client.
 */
export function wrapAnthropic<T extends object>(
  client: T,
  aiCost: AICost
): T {
  if (!client || (client as any)[WRAPPED_MARKER]) {
    return client;
  }

  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      if (prop === WRAPPED_MARKER) {
        return true;
      }
      const value = Reflect.get(target, prop, receiver);
      if (prop === 'messages' && value && typeof value === 'object') {
        return wrapAnthropicMessages(value, aiCost);
      }
      return value;
    }
  };

  return new Proxy(client, handler);
}

