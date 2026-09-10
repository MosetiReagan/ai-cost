/**
 * Example routing to Google Gemini 1.5 Flash through the AI Cost OpenAI-compatible Gateway.
 */
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.AI_COST_API_KEY || 'ac_live_demo_prod_chatbot_987654321',
  baseURL: process.env.AI_COST_GATEWAY_URL || 'http://localhost:4000/v1'
});

async function main() {
  console.log('Routing to Gemini 1.5 Flash through AI Cost Gateway...');
  const response = await client.chat.completions.create({
    model: 'gemini-1.5-flash',
    messages: [
      { role: 'user', content: 'Summarize the advantages of edge computing.' }
    ]
  });

  console.log('\nResponse:');
  console.log(response.choices[0].message.content);
  console.log('\nUsage:');
  console.log(response.usage);
}

main().catch(console.error);
