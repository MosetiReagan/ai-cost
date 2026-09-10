import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createDatabaseClient, Repository, IDatabaseClient } from '@ai-cost/database';
import { buildServer } from '../src/server.js';
import { UsageQueue } from '../src/queue.js';
import { FastifyInstance } from 'fastify';

describe('AI Cost Gateway', () => {
  let db: IDatabaseClient;
  let repo: Repository;
  let queue: UsageQueue;
  let server: FastifyInstance;
  let validRawKey = 'ac_live_test_gateway_key_999';
  let projectId: string;

  beforeAll(async () => {
    db = await createDatabaseClient();
    repo = new Repository(db);
    queue = new UsageQueue(repo);

    const org = await repo.createOrganization('Gateway Org', 'gateway-org');
    const project = await repo.createProject({
      organizationId: org.id,
      name: 'Gateway Project',
      slug: 'gateway-project'
    });
    projectId = project.id;

    const hashedKey = createHash('sha256').update(validRawKey).digest('hex');
    await repo.createApiKey({
      projectId,
      keyPrefix: 'ac_live_test...',
      name: 'Gateway Test Key',
      hashedKey
    });

    server = buildServer({ repo, queue, logger: false });
    await server.ready();
  });

  const originalFetch = global.fetch;

  afterAll(async () => {
    global.fetch = originalFetch;
    await queue.stop();
    await server.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await db.close();
  });

  it('responds to /health and /ready', async () => {
    const health = await server.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body).status).toBe('ok');

    const ready = await server.inject({ method: 'GET', url: '/ready' });
    expect(ready.statusCode).toBe(200);
    expect(JSON.parse(ready.body).status).toBe('ready');
  });

  it('rejects unauthenticated requests to /v1/chat/completions', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      payload: { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }] }
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('unauthorized');
  });

  it('rejects invalid API key', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: {
        authorization: 'Bearer ac_live_invalid_key'
      },
      payload: { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }] }
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('invalid_api_key');
  });

  it('forwards chat completion request and returns AI Cost observability headers', async () => {
    // Mock global fetch for upstream provider
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-mock-456',
          object: 'chat.completion',
          created: 1700000000,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Mock response from upstream.' },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 120,
            completion_tokens: 45,
            total_tokens: 165
          }
        })
      };
    });

    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: {
        authorization: `Bearer ${validRawKey}`,
        'x-provider-api-key': 'sk-mock-provider-key'
      },
      payload: {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Tell me a joke.' }]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.choices[0].message.content).toBe('Mock response from upstream.');

    // Verify AI Cost Observability Headers
    expect(res.headers['x-ai-cost-request-id']).toBeDefined();
    expect(res.headers['x-ai-cost-tokens-total']).toBe('165');
    expect(res.headers['x-ai-cost-tokens-input']).toBe('120');
    expect(res.headers['x-ai-cost-tokens-output']).toBe('45');
    expect(res.headers['x-ai-cost-estimated-cost']).toBeDefined();

    // Flush queue to database and verify recorded usage
    await queue.flush();

    const requests = await repo.listRequests({ projectId });
    expect(requests.data.length).toBeGreaterThanOrEqual(1);
    const req = requests.data[0];
    expect(req.provider).toBe('openai');
    expect(req.model).toBe('gpt-4o');
    expect(req.inputTokens).toBe(120);
    expect(req.outputTokens).toBe(45);
    expect(req.totalTokens).toBe(165);
    expect(req.estimatedCost).toBeGreaterThan(0);
    expect(req.status).toBe('success');
  });

  it('translates Anthropic requests transparently', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      // Return Anthropic message response
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'msg_anthropic_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Anthropic response' }],
          model: 'claude-3-5-sonnet-latest',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 250,
            output_tokens: 80,
            cache_read_input_tokens: 100
          }
        })
      };
    });

    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: {
        authorization: `Bearer ${validRawKey}`
      },
      payload: {
        model: 'claude-3-5-sonnet-latest',
        messages: [{ role: 'user', content: 'Explain quantum computing' }]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.object).toBe('chat.completion');
    expect(body.choices[0].message.content).toBe('Anthropic response');
    expect(body.usage.prompt_tokens).toBe(250);
    expect(body.usage.completion_tokens).toBe(80);
    expect(res.headers['x-ai-cost-tokens-total']).toBe('330');
  });

  it('translates Google Gemini requests transparently', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Hello from Gemini!' }]
              },
              finishReason: 'STOP'
            }
          ],
          usageMetadata: {
            promptTokenCount: 180,
            candidatesTokenCount: 60,
            totalTokenCount: 240
          }
        })
      };
    });

    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: {
        authorization: `Bearer ${validRawKey}`
      },
      payload: {
        model: 'gemini-1.5-flash',
        messages: [{ role: 'user', content: 'Say hello' }]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.choices[0].message.content).toBe('Hello from Gemini!');
    expect(body.usage.prompt_tokens).toBe(180);
    expect(body.usage.completion_tokens).toBe(60);
    expect(res.headers['x-ai-cost-tokens-total']).toBe('240');
  });

  it('proxies Ollama requests and records $0.00 base cost', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-ollama-1',
          object: 'chat.completion',
          model: 'llama3.3',
          choices: [
            {
              message: { role: 'assistant', content: 'Local Ollama response' },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 80,
            completion_tokens: 30,
            total_tokens: 110
          }
        })
      };
    });

    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: {
        authorization: `Bearer ${validRawKey}`
      },
      payload: {
        model: 'llama3.3',
        messages: [{ role: 'user', content: 'Hello local model' }]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.choices[0].message.content).toBe('Local Ollama response');
    expect(res.headers['x-ai-cost-estimated-cost']).toBe('0.000000');
  });

  it('supports streaming responses and extracts tokens from SSE stream', async () => {
    const ssePayload = [
      'data: {"id":"chatcmpl-stream-1","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-stream-1","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-stream-1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":25,"completion_tokens":10,"total_tokens":35}}\n\n',
      'data: [DONE]\n\n'
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      }
    });

    global.fetch = vi.fn().mockImplementation(async () => {
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      });
    });

    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: {
        authorization: `Bearer ${validRawKey}`,
        'x-provider-api-key': 'sk-mock-key'
      },
      payload: {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Stream test' }],
        stream: true
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body).toContain('Hello');
    expect(res.body).toContain(' world');

    await queue.flush();
    const requests = await repo.listRequests({ projectId });
    const streamedReq = requests.data.find(r => r.inputTokens === 25);
    expect(streamedReq).toBeDefined();
    expect(streamedReq?.outputTokens).toBe(10);
  });

  it('handles upstream timeout gracefully with 504 status code', async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    });

    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: {
        authorization: `Bearer ${validRawKey}`,
        'x-provider-api-key': 'sk-mock-key'
      },
      payload: {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Timeout test' }]
      }
    });

    expect(res.statusCode).toBe(504);
    const body = JSON.parse(res.body);
    expect(body.error.type).toBe('gateway_timeout');
  });

  it('rejects unknown explicit provider with HTTP 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: {
        authorization: `Bearer ${validRawKey}`,
        'x-provider': 'invalid-provider'
      },
      payload: {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }]
      }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.type).toBe('invalid_request_error');
    expect(body.error.message).toContain('Unknown provider');
  });

  it('enforces request rate limiting with HTTP 429', async () => {
    const rateLimitedServer = buildServer({ repo, queue, rateLimitMax: 2 });
    await rateLimitedServer.ready();

    try {
      const makeReq = () =>
        rateLimitedServer.inject({
          method: 'GET',
          url: '/health'
        });

      const r1 = await makeReq();
      const r2 = await makeReq();
      const r3 = await makeReq();
      const r4 = await makeReq();

      expect([r1.statusCode, r2.statusCode, r3.statusCode, r4.statusCode]).toContain(429);
    } finally {
      await rateLimitedServer.close();
    }
  });
});

