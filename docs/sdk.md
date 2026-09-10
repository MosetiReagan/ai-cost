# AI Cost TypeScript SDK

The `@ai-cost/sdk` package allows programmatic reporting of AI usage when direct gateway routing isn't used.

## Installation

```bash
npm install @ai-cost/sdk
```

## Manual Tracking

```typescript
import { AICost } from '@ai-cost/sdk';

const aiCost = new AICost({
  apiKey: process.env.AI_COST_API_KEY,
  baseUrl: 'http://localhost:3001'
});

await aiCost.track({
  provider: 'openai',
  model: 'gpt-4o',
  inputTokens: 1200,
  outputTokens: 540,
  cachedTokens: 800,
  latencyMs: 430,
  tags: { feature: 'semantic-search' }
});
```

## Automatic OpenAI SDK Wrapper

```typescript
import OpenAI from 'openai';
import { AICost, wrapOpenAI } from '@ai-cost/sdk';

const aiCost = new AICost({ apiKey: '...' });
const openai = wrapOpenAI(new OpenAI(), aiCost);

// Now all completions automatically log latency & token counts
await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hi' }]
});
```
