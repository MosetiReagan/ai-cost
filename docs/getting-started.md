# Getting Started with AI Cost

AI Cost gives engineering teams total visibility into AI inference costs, token consumption, latency, and error rates across all major LLM providers.

## 5-Minute Quickstart

### 1. Run with Docker Compose

```bash
git clone https://github.com/your-username/ai-cost.git
cd ai-cost
docker compose up -d
```

Open `http://localhost:3000` to view the AI Cost Dashboard.

### 2. Local Node.js Development

```bash
git clone https://github.com/your-username/ai-cost.git
cd ai-cost
npm install
npm run seed      # Populates 30 days of realistic multi-provider telemetry
npm run dev
```

### 3. Route Your First Request

Point your existing OpenAI SDK client at the AI Cost Gateway:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'ac_live_demo_prod_chatbot_987654321', // Your AI Cost project key
  baseURL: 'http://localhost:4000/v1'            // AI Cost Gateway
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello world!' }]
});
```
