# Pricing Engine & Custom Rates

AI Cost provides a centralized pricing registry (`packages/pricing`) with official rates per 1,000,000 tokens for:

- **OpenAI**: GPT-4o, GPT-4o Mini, o1, o1-mini, o3-mini, GPT-4 Turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus
- **Google Gemini**: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0 Flash
- **Local Models (Ollama)**: Default \$0.00 direct cost

## Prompt Caching Discounts

Providers like Anthropic and OpenAI offer significant discounts (up to 90%) for cached input tokens. AI Cost tracks cached tokens separately and calculates actual savings.

## Custom Pricing Overrides

You can define custom model pricing or infrastructure costs directly from the dashboard under **Model Pricing** or via the API:

```bash
curl -X POST http://localhost:3001/api/pricing/custom \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "custom-llm",
    "model": "fine-tuned-rag",
    "displayName": "Internal RAG Model",
    "inputCostPerMillion": 1.50,
    "outputCostPerMillion": 4.50
  }'
```
