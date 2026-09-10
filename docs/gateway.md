# AI Cost Gateway Guide

The AI Cost Gateway (`:4000`) is a high-performance reverse proxy that transparently forwards requests to OpenAI, Anthropic, Google Gemini, and local Ollama instances while collecting telemetry with near-zero overhead.

## Endpoints

- `POST /v1/chat/completions` — Standard OpenAI-compatible chat completion endpoint.
- `GET /v1/models` — Lists available models and pricing metadata.
- `GET /health` — Liveness health check.
- `GET /ready` — Readiness check verifying database connectivity.

## Provider Routing

The Gateway inspects the `model` parameter or custom `x-provider` header:

| Model Prefix / Pattern | Routed Provider | Upstream Protocol |
|---|---|---|
| `gpt-*`, `o1*`, `o3*` | OpenAI | Native OpenAI API |
| `claude-*` | Anthropic | Translated to Anthropic Messages API |
| `gemini-*` | Google Gemini | Translated to Gemini generateContent |
| `llama*`, `mistral*` | Ollama | Forwarded to local Ollama (`:11434`) |

## Response Observability Headers

Every gateway response includes real-time telemetry headers:
- `x-ai-cost-request-id`: Unique request ID
- `x-ai-cost-estimated-cost`: Calculated cost in USD (e.g. `0.007500`)
- `x-ai-cost-latency-ms`: Total duration in milliseconds
- `x-ai-cost-tokens-total`: Combined input and output tokens
