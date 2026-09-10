import { ForwardContext, ProviderResult } from './types.js';

export async function forwardGemini(ctx: ForwardContext): Promise<ProviderResult> {
  const apiKey = ctx.providerApiKey || process.env.GEMINI_API_KEY || '';
  const baseUrl = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models').replace(/\/$/, '');

  let modelName = ctx.model;
  if (modelName.startsWith('gemini/')) {
    modelName = modelName.replace('gemini/', '');
  }

  const isStreaming = ctx.body?.stream === true;
  const url = isStreaming
    ? `${baseUrl}/${modelName}:streamGenerateContent?alt=sse`
    : `${baseUrl}/${modelName}:generateContent`;

  const rawMessages: any[] = ctx.body.messages || [];
  let systemInstruction: any = undefined;
  const contents: any[] = [];

  for (const msg of rawMessages) {
    if (msg.role === 'system') {
      systemInstruction = {
        parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
      };
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
      });
    }
  }

  const payload: any = {
    contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }]
  };
  if (systemInstruction) {
    payload.systemInstruction = systemInstruction;
  }
  if (ctx.body.temperature !== undefined) {
    payload.generationConfig = {
      temperature: ctx.body.temperature,
      maxOutputTokens: ctx.body.max_tokens
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['x-goog-api-key'] = apiKey;
  }

  const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 60_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const statusCode = res.status;

    if (isStreaming && res.ok && res.body) {
      const geminiReader = res.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';
      const messageId = `chatcmpl-${ctx.requestId}`;
      const created = Math.floor(Date.now() / 1000);
      let promptTokens = 0;
      let candidateTokens = 0;

      const stream = new ReadableStream({
        async pull(controller) {
          while (true) {
            const { done, value } = await geminiReader.read();
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
                if (event.usageMetadata) {
                  promptTokens = event.usageMetadata.promptTokenCount ?? promptTokens;
                  candidateTokens = event.usageMetadata.candidatesTokenCount ?? candidateTokens;
                }
                const candidate = event.candidates?.[0];
                const text = candidate?.content?.parts?.[0]?.text;
                const finishReason = candidate?.finishReason === 'STOP' ? 'stop' : (candidate?.finishReason || null);

                if (text) {
                  const chunk = {
                    id: messageId,
                    object: 'chat.completion.chunk',
                    created,
                    model: ctx.model,
                    choices: [
                      {
                        index: 0,
                        delta: { content: text },
                        finish_reason: null
                      }
                    ]
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }

                if (finishReason) {
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
                      prompt_tokens: promptTokens,
                      completion_tokens: candidateTokens,
                      total_tokens: promptTokens + candidateTokens
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
            message: body?.error?.message || `Gemini returned HTTP ${statusCode}`,
            type: 'upstream_error'
          }
        },
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        rawUsageAvailable: false,
        errorMessage: body?.error?.message || `HTTP ${statusCode}`
      };
    }

    const usage = body?.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;
    const cachedTokens = usage?.cachedContentTokenCount ?? 0;

    const candidate = body?.candidates?.[0];
    const textContent = candidate?.content?.parts?.map((p: any) => p.text || '').join('') || '';

    const openAIFormattedBody = {
      id: `chatcmpl-${ctx.requestId}`,
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
          finish_reason: candidate?.finishReason === 'STOP' ? 'stop' : 'length'
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
      rawUsageAvailable: !!usage
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        statusCode: 504,
        body: { error: { message: `Gateway timed out waiting for Gemini after ${timeoutMs}ms`, type: 'gateway_timeout' } },
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        rawUsageAvailable: false,
        errorMessage: `Upstream timed out after ${timeoutMs}ms`
      };
    }
    return {
      statusCode: 502,
      body: { error: { message: `Gateway failed to reach Gemini: ${err.message}`, type: 'gateway_error' } },
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
