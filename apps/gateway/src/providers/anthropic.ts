import { ForwardContext, ProviderResult } from './types.js';

export async function forwardAnthropic(ctx: ForwardContext): Promise<ProviderResult> {
  const apiKey = ctx.providerApiKey || process.env.ANTHROPIC_API_KEY || '';
  const baseUrl = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1').replace(/\/$/, '');
  const url = `${baseUrl}/messages`;

  // Translate OpenAI messages payload to Anthropic format
  const rawMessages: any[] = ctx.body.messages || [];
  let systemPrompt: string | undefined = undefined;
  const anthropicMessages: any[] = [];

  for (const msg of rawMessages) {
    if (msg.role === 'system') {
      systemPrompt = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    } else {
      anthropicMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    }
  }

  // Model mapping
  let modelName = ctx.model;
  if (modelName.startsWith('anthropic/')) {
    modelName = modelName.replace('anthropic/', '');
  }

  const payload: any = {
    model: modelName,
    messages: anthropicMessages.length > 0 ? anthropicMessages : [{ role: 'user', content: 'Hello' }],
    max_tokens: ctx.body.max_tokens || 4096,
    temperature: ctx.body.temperature ?? 0.7
  };
  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01'
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const statusCode = res.status;
    const body: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        statusCode,
        body: {
          error: {
            message: body?.error?.message || `Anthropic returned HTTP ${statusCode}`,
            type: body?.error?.type || 'upstream_error'
          }
        },
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        rawUsageAvailable: false,
        errorMessage: body?.error?.message || `HTTP ${statusCode}`
      };
    }

    const inputTokens = body?.usage?.input_tokens ?? 0;
    const outputTokens = body?.usage?.output_tokens ?? 0;
    const cachedTokens = body?.usage?.cache_read_input_tokens ?? 0;

    // Convert Anthropic response to OpenAI Chat Completion format
    const textContent = body?.content?.map((c: any) => c.text || '').join('\n') || '';
    const openAIFormattedBody = {
      id: body.id || `chatcmpl-${ctx.requestId}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: ctx.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: textContent
          },
          finish_reason: body.stop_reason === 'max_tokens' ? 'length' : 'stop'
        }
      ],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        prompt_tokens_details: {
          cached_tokens: cachedTokens
        }
      }
    };

    return {
      statusCode,
      body: openAIFormattedBody,
      inputTokens,
      outputTokens,
      cachedTokens,
      rawUsageAvailable: true
    };
  } catch (err: any) {
    return {
      statusCode: 502,
      body: { error: { message: `Gateway failed to reach Anthropic: ${err.message}`, type: 'gateway_error' } },
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      rawUsageAvailable: false,
      errorMessage: err.message
    };
  }
}
