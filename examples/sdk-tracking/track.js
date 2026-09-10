/**
 * Example using @ai-cost/sdk for direct programmatic usage reporting.
 */
import { AICost } from '@ai-cost/sdk';

const aiCost = new AICost({
  apiKey: process.env.AI_COST_API_KEY || 'ac_live_demo_prod_chatbot_987654321',
  baseUrl: 'http://localhost:3001'
});

async function main() {
  console.log('Tracking custom AI inference event...');

  const startTime = Date.now();
  // ... your AI call here ...
  const latencyMs = Date.now() - startTime + 380;

  await aiCost.track({
    provider: 'openai',
    model: 'gpt-4o',
    inputTokens: 1250,
    outputTokens: 480,
    cachedTokens: 800,
    latencyMs,
    tags: {
      team: 'search',
      feature: 'query-expansion'
    }
  });

  await aiCost.flush();
  console.log('✓ Successfully reported telemetry to AI Cost!');
}

main().catch(console.error);
