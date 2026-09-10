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

  const isStreaming = ctx.body?.stream === true;
  const payload: any = {
    model: modelName,
    messages: anthropicMessages.length > 0 ? anthropicMessages : [{ role: 'user', content: 'Hello' }],
    max_tokens: ctx.body.max_tokens || 4096,
    temperature: ctx.body.temperature ?? 0.7
  };
  if (systemPrompt) {
    payload.system = systemPrompt;
  }
  if (isStreaming) {
    payload.stream = true;
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

    if (isStreaming && res.ok && res.body) {
      const anthropicReader = res.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';
      const messageId = `chatcmpl-${ctx.requestId}`;
      const created = Math.floor(Date.now() / 1000);
      let inputTokens = 0;
      let outputTokens = 0;

      const stream = new ReadableStream({
        async pull(controller) {
          while (true) {
            const { done, value } = await anthropicReader.read();
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const dataStr = trimmed.slice(5).trim();
              if (!dataStr || dataStr === '[DONE]') continue;

              try {
                const event = JSON.parse(dataStr);
                if (event.type === 'message_start' && event.message) {
                  if (event.message.usage?.input_tokens) {
                    inputTokens = event.message.usage.input_tokens;
                  }
                } else if (event.type === 'content_block_delta' && event.delta?.text) {
                  const chunk = {
                    id: messageId,
                    object: 'chat.completion.chunk',
                    created,
                    model: ctx.model,
                    choices: [
                      {
                        index: 0,
                        delta: { content: event.delta.text },
                        finish_reason: null
                      }
                    ]
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                } else if (event.type === 'message_delta') {
                  if (event.usage?.output_tokens) {
                    outputTokens = event.usage.output_tokens;
                  }
                  const finishReason = event.delta?.stop_reason === 'end_turn' ? 'stop' : (event.delta?.stop_reason || null);
                  const chunk = {
                    id: messageId,
                    object: 'chat.completion.chunk',
                    created,
                    model: ctx.model,
                    choices: [
                      {
                        index: 0,
                        delta: {},
                        finish_reason: finishReason
                      }
                    ],
                    usage: {
                      prompt_tokens: inputTokens,
                      completion_tokens: outputTokens,
                      total_tokens: inputTokens + outputTokens
                    }
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              } catch {
                // ignore
              }
            }
          }
        }
      });

      return {
        statusCode,
        body: null,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        rawUsageAvailable: false,
        isStream: true,
        streamResponse: new Response(stream)
      };
    }

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
