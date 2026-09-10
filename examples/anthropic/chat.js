/**
 * Example routing to Claude 3.5 Sonnet through the AI Cost OpenAI-compatible Gateway.
 */
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.AI_COST_API_KEY || 'ac_live_demo_prod_chatbot_987654321',
  baseURL: process.env.AI_COST_GATEWAY_URL || 'http://localhost:4000/v1'
});

async function main() {
  console.log('Routing to Anthropic Claude 3.5 Sonnet through AI Cost Gateway...');
  const response = await client.chat.completions.create({
    model: 'claude-3-5-sonnet-latest',
    messages: [
      { role: 'user', content: 'Write a haiku about high-performance software architecture.' }
    ]
  });

  console.log('\nResponse:');
  console.log(response.choices[0].message.content);
  console.log('\nUsage reported & tracked by AI Cost:');
  console.log(response.usage);
}

main().catch(console.error);
