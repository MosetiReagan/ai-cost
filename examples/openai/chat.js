/**
 * Example using the OpenAI Node SDK pointed at the AI Cost Gateway.
 * No architectural changes required — just change the baseURL!
 */
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AI_COST_API_KEY || 'ac_live_demo_prod_chatbot_987654321',
  baseURL: process.env.OPENAI_BASE_URL || 'http://localhost:4000/v1'
});

async function main() {
  console.log('Sending chat completion via AI Cost Gateway...');
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: 'Explain what an LLM token is in 2 sentences.' }
    ]
  });

  console.log('\nResponse:');
  console.log(response.choices[0].message.content);
  console.log('\nToken Usage:');
  console.log(response.usage);
}

main().catch(console.error);
