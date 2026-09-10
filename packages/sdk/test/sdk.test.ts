import { describe, it, expect, vi } from 'vitest';
import { AICost, wrapOpenAI } from '../src/index.js';

describe('AICost SDK', () => {
  it('queues events and flushes them', async () => {
    let sentPayload: any = null;
    // Mock fetch
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      sentPayload = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
    });

    const client = new AICost({
      apiKey: 'ac_live_test123',
      baseUrl: 'http://localhost:3001',
      batchSize: 2
    });

    await client.track({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 320
    });

    expect(sentPayload).toBeNull(); // batch size not reached yet

    await client.track({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-latest',
      inputTokens: 200,
      outputTokens: 100,
      latencyMs: 450
    });

    // Batch size reached, should auto flush
    expect(sentPayload).not.toBeNull();
    expect(sentPayload.batch.length).toBe(2);
    expect(sentPayload.batch[0].provider).toBe('openai');
    expect(sentPayload.batch[1].provider).toBe('anthropic');
  });

  it('wrapOpenAI intercepts calls and reports metrics', async () => {
    const mockAICost = {
      track: vi.fn().mockResolvedValue(undefined)
    } as any;

    const mockOpenAIClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            id: 'chatcmpl-123',
            model: 'gpt-4o',
            usage: {
              prompt_tokens: 150,
              completion_tokens: 75,
              total_tokens: 225
            },
            choices: [{ message: { role: 'assistant', content: 'Hello!' } }]
          })
        }
      }
    };

    const wrapped = wrapOpenAI(mockOpenAIClient, mockAICost);
    const result = await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }]
    });

    expect(result.choices[0].message.content).toBe('Hello!');
    expect(mockAICost.track).toHaveBeenCalledTimes(1);
    expect(mockAICost.track).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 150,
        outputTokens: 75,
        status: 'success'
      })
    );

    // Verify non-destructive wrapping and double-wrap protection
    expect(mockOpenAIClient.chat.completions.create).not.toBe(wrapped.chat.completions.create);
    const doubleWrapped = wrapOpenAI(wrapped, mockAICost);
    expect(doubleWrapped).toBe(wrapped);
  });

  it('wrapAnthropic intercepts calls and reports metrics', async () => {
    const mockAICost = {
      track: vi.fn().mockResolvedValue(undefined)
    } as any;

    const mockAnthropicClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          id: 'msg-123',
          model: 'claude-3-5-sonnet-20241022',
          usage: {
            input_tokens: 300,
            output_tokens: 120,
            cache_read_input_tokens: 50
          },
          content: [{ type: 'text', text: 'Hello from Claude!' }],
          stop_reason: 'end_turn'
        })
      }
    };

    const { wrapAnthropic } = await import('../src/index.js');
    const wrapped = wrapAnthropic(mockAnthropicClient, mockAICost);
    const result = await wrapped.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'Hi Claude' }]
    });

    expect(result.content[0].text).toBe('Hello from Claude!');
    expect(mockAICost.track).toHaveBeenCalledTimes(1);
    expect(mockAICost.track).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 300,
        outputTokens: 120,
        cachedTokens: 50,
        status: 'success'
      })
    );
  });

  it('re-queues events on network failure and retries on subsequent flush', async () => {
    let callCount = 0;
    let deliveredPayload: any = null;

    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      callCount++;
      if (callCount === 1) {
        // First flush fails with 503 Service Unavailable
        return { ok: false, status: 503, statusText: 'Service Unavailable' };
      }
      // Second flush succeeds
      deliveredPayload = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
    });

    const client = new AICost({
      apiKey: 'ac_test_retry',
      batchSize: 10,
      maxRetries: 3
    });

    await client.track({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 50,
      outputTokens: 25,
      latencyMs: 150
    });

    expect(client.queueLength).toBe(1);

    // First flush fails, event should be re-queued
    await client.flush();
    expect(client.queueLength).toBe(1);
    expect(deliveredPayload).toBeNull();

    // Second flush succeeds
    await client.flush();
    expect(client.queueLength).toBe(0);
    expect(deliveredPayload).not.toBeNull();
    expect(deliveredPayload.batch.length).toBe(1);
    expect(deliveredPayload.batch[0].model).toBe('gpt-4o');
  });

  it('wrapOpenAI captures streaming usage and yields all chunks', async () => {
    const mockAICost = {
      track: vi.fn().mockResolvedValue(undefined)
    } as any;

    async function* makeStream() {
      yield { id: 'chunk-1', model: 'gpt-4o-mini', choices: [{ delta: { content: 'Hello ' } }] };
      yield {
        id: 'chunk-2',
        model: 'gpt-4o-mini',
        choices: [{ delta: { content: 'world!' } }],
        usage: { prompt_tokens: 35, completion_tokens: 12 }
      };
    }

    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(makeStream())
        }
      }
    };

    const wrapped = wrapOpenAI(mockOpenAI, mockAICost);
    const stream = await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [{ role: 'user', content: 'Say hello' }]
    });

    const receivedChunks: any[] = [];
    for await (const chunk of stream) {
      receivedChunks.push(chunk);
    }

    expect(receivedChunks.length).toBe(2);
    expect(receivedChunks[0].choices[0].delta.content).toBe('Hello ');
    expect(receivedChunks[1].choices[0].delta.content).toBe('world!');

    expect(mockAICost.track).toHaveBeenCalledTimes(1);
    expect(mockAICost.track).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 35,
        outputTokens: 12,
        status: 'success'
      })
    );
  });

  it('wrapAnthropic captures streaming usage from message chunks', async () => {
    const mockAICost = {
      track: vi.fn().mockResolvedValue(undefined)
    } as any;

    async function* makeAnthropicStream() {
      yield {
        type: 'message_start',
        message: {
          id: 'msg-stream-1',
          model: 'claude-3-5-sonnet-20241022',
          usage: { input_tokens: 80, cache_read_input_tokens: 20 }
        }
      };
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Anthropic stream' }
      };
      yield {
        type: 'message_delta',
        usage: { output_tokens: 45 }
      };
    }

    const mockAnthropic = {
      messages: {
        create: vi.fn().mockResolvedValue(makeAnthropicStream())
      }
    };

    const { wrapAnthropic } = await import('../src/index.js');
    const wrapped = wrapAnthropic(mockAnthropic, mockAICost);
    const stream = await wrapped.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      stream: true,
      messages: [{ role: 'user', content: 'Stream test' }]
    });

    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(3);
    expect(mockAICost.track).toHaveBeenCalledTimes(1);
    expect(mockAICost.track).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 80,
        outputTokens: 45,
        cachedTokens: 20,
        status: 'success'
      })
    );
  });
});

