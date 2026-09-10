# Multi-Provider Architecture

AI Cost includes built-in provider adapters that normalize API contracts, authenticate against upstream services, and standardize usage data into a single unified telemetry format.

---

## Supported Providers

| Provider | Gateway Support | Upstream Authentication | Token Accounting | Streaming Support |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | Direct (`/v1/chat/completions`) | `OPENAI_API_KEY` or `x-provider-api-key` | Prompt + Completion + Cached Tokens | Yes |
| **Anthropic** | Format Translation (`/v1/messages`) | `ANTHROPIC_API_KEY` or `x-provider-api-key` | Input + Output + Cache Read Tokens | Yes |
| **Google Gemini** | Format Translation (`generateContent`) | `GEMINI_API_KEY` or `x-provider-api-key` | Prompt + Candidates + Cached Tokens | Yes |
| **Ollama (Local)** | Direct OpenAI compatibility | None required (default `http://localhost:11434`) | Evaluated Prompt + Completion ($0.00 base) | Yes |

---

## Provider Resolution & Routing

The AI Cost Gateway automatically determines the downstream provider based on the requested model name, or via an explicit routing header:

### 1. By Model Name Pattern

* **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `o1`, `o1-mini`, `o3-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`, etc.
* **Anthropic**: Any model containing `claude` (e.g. `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest`, `claude-3-opus-latest`) or prefixed with `anthropic/`.
* **Google Gemini**: Any model containing `gemini` (e.g. `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.0-flash`) or prefixed with `gemini/`.
* **Ollama (Local)**: Any model containing `llama`, `mistral`, `deepseek-r1:`, or prefixed with `ollama/`.

### 2. By Explicit Header

You can force a specific provider route regardless of the model identifier by providing the `x-provider` header:

```http
POST /v1/chat/completions HTTP/1.1
Host: localhost:4000
Authorization: Bearer ac_live_xxxxxxxxx
x-provider: anthropic
Content-Type: application/json

{
  "model": "my-custom-fine-tune",
  "messages": [{"role": "user", "content": "Hello"}]
}
```

---

## Authentication Modes

Downstream AI providers can be authenticated in two ways:

1. **Centralized Infrastructure Keys (Default)**: Set server environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`). The gateway will forward requests using the central organization keys.
2. **Client-Supplied Provider Keys**: Applications can pass per-tenant or per-client provider keys in the `x-provider-api-key` header or standard `Authorization: Bearer <provider-key>` (if using `x-ai-cost-key: ac_live_...` for AI Cost authentication).

---

## Local Model Support (Ollama)

AI Cost supports monitoring locally running open-weight models via Ollama.

```env
OLLAMA_BASE_URL=http://localhost:11434
```

* In local Ollama requests, base unit costs are computed as `$0.00`.
* Custom infrastructure hosting costs (e.g. GPU compute allocation) can be assigned to local models via **Custom Model Pricing** in the dashboard.
* This allows engineering teams to benchmark **Cloud Model Cost vs Local Model Cost** directly on the dashboard.
