import { randomUUID } from 'node:crypto';
import { getDatabase, Repository } from '@ai-cost/database';
import { calculateCost } from '@ai-cost/pricing';
import { createHash } from 'node:crypto';

async function seed() {
  console.log('🌱 [ai-cost/seed] Starting demo data generation...');

  const db = await getDatabase();
  const repo = new Repository(db);

  // 1. Create Demo Organization & Admin
  const org = await repo.createOrganization('Acme AI (Demo)', 'acme-demo');
  console.log(`✓ Organization: ${org.name}`);

  // Create password hash (salt + scrypt equivalent or standard)
  const user = await repo.createUser({
    organizationId: org.id,
    email: 'admin@aicost.local',
    passwordHash: '8b7f32a67e16a909.1234567890abcdef', // recognized or setup
    name: 'Demo Administrator',
    role: 'owner'
  });
  console.log(`✓ Admin User: ${user.email}`);

  // 2. Create Projects
  const chatbotProject = await repo.createProject({
    organizationId: org.id,
    name: 'Production Chatbot',
    slug: 'prod-chatbot',
    description: 'Customer facing LLM chatbot running in production',
    environment: 'production'
  });

  const supportProject = await repo.createProject({
    organizationId: org.id,
    name: 'Customer Support Bot',
    slug: 'support-bot',
    description: 'Automated tier-1 support ticket categorization & drafting',
    environment: 'production'
  });

  const devProject = await repo.createProject({
    organizationId: org.id,
    name: 'Internal Research & Testing',
    slug: 'internal-research',
    description: 'Dev experimentation with local Ollama and flagship reasoning models',
    environment: 'development'
  });
  console.log('✓ Created 3 projects: Production Chatbot, Customer Support Bot, Internal Research');

  // 3. Create API Keys
  const chatbotRawKey = 'ac_live_demo_prod_chatbot_987654321';
  await repo.createApiKey({
    projectId: chatbotProject.id,
    keyPrefix: 'ac_live_demo_prod...',
    name: 'Production Chatbot Key',
    hashedKey: createHash('sha256').update(chatbotRawKey).digest('hex')
  });

  const supportRawKey = 'ac_live_demo_support_bot_123456789';
  await repo.createApiKey({
    projectId: supportProject.id,
    keyPrefix: 'ac_live_demo_supp...',
    name: 'Support Bot Key',
    hashedKey: createHash('sha256').update(supportRawKey).digest('hex')
  });
  console.log('✓ Generated demo API keys');

  // 4. Create Budgets
  await repo.setBudget({
    projectId: chatbotProject.id,
    monthlyBudgetUsd: 450.0,
    alertThresholdPercent: 80
  });

  await repo.setBudget({
    projectId: supportProject.id,
    monthlyBudgetUsd: 150.0,
    alertThresholdPercent: 75
  });
  console.log('✓ Configured project monthly budgets');

  // 5. Generate Realistic Request History across 30 Days
  console.log('⏳ Generating 30-day realistic usage history across OpenAI, Anthropic, Gemini, Ollama...');

  const modelProfiles = [
    { provider: 'openai', model: 'gpt-4o', weight: 35, avgInput: 1400, avgOutput: 550, latencyRange: [400, 1100], cacheable: true },
    { provider: 'openai', model: 'gpt-4o-mini', weight: 25, avgInput: 800, avgOutput: 300, latencyRange: [180, 450], cacheable: true },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-latest', weight: 20, avgInput: 2200, avgOutput: 800, latencyRange: [600, 1800], cacheable: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', weight: 12, avgInput: 1800, avgOutput: 400, latencyRange: [190, 500], cacheable: false },
    { provider: 'ollama', model: 'llama3.3', weight: 8, avgInput: 1000, avgOutput: 350, latencyRange: [800, 2200], cacheable: false }
  ];

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  let totalGenerated = 0;
  let totalCostSum = 0;

  // Generate ~450 requests spread over 30 days
  const totalSamples = 450;
  for (let i = 0; i < totalSamples; i++) {
    // Bias timestamps towards more recent days to show realistic upward growth
    const progress = Math.pow(i / totalSamples, 1.4);
    const timestamp = new Date(now - thirtyDaysMs + progress * thirtyDaysMs);

    // Pick project
    const proj = i % 2 === 0 ? chatbotProject : i % 3 === 0 ? supportProject : devProject;

    // Pick model based on weights
    const rand = Math.random() * 100;
    let cumulative = 0;
    let chosenProfile = modelProfiles[0];
    for (const p of modelProfiles) {
      cumulative += p.weight;
      if (rand <= cumulative) {
        chosenProfile = p;
        break;
      }
    }

    // Token variations
    const inputVariance = 0.6 + Math.random() * 0.8;
    const outputVariance = 0.5 + Math.random() * 1.0;
    const inputTokens = Math.round(chosenProfile.avgInput * inputVariance);
    const outputTokens = Math.round(chosenProfile.avgOutput * outputVariance);
    const cachedTokens = chosenProfile.cacheable && Math.random() > 0.4 ? Math.round(inputTokens * 0.7) : 0;

    // Latency
    const [minLat, maxLat] = chosenProfile.latencyRange;
    const latencyMs = Math.round(minLat + Math.random() * (maxLat - minLat));

    // Error rate (~2.5%)
    const isError = Math.random() < 0.025;
    const statusCode = isError ? (Math.random() > 0.5 ? 429 : 500) : 200;
    const status = isError ? 'error' : 'success';
    const errorMessage = isError ? (statusCode === 429 ? 'Rate limit exceeded: quota depleted' : 'Internal upstream provider error') : undefined;

    const costRes = calculateCost({
      provider: chosenProfile.provider,
      model: chosenProfile.model,
      inputTokens,
      outputTokens,
      cachedTokens
    });

    const cost = isError ? 0 : costRes.totalCost;
    totalCostSum += cost;

    await repo.recordRequest({
      id: randomUUID(),
      requestId: `req_demo_${randomUUID().slice(0, 8)}`,
      projectId: proj.id,
      provider: chosenProfile.provider,
      model: chosenProfile.model,
      inputTokens,
      outputTokens,
      cachedTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: cost,
      latencyMs,
      statusCode,
      status,
      errorMessage,
      environment: proj.environment,
      timestamp
    });

    totalGenerated++;
  }

  // Trigger demo budget warning alert
  await repo.createAlert({
    projectId: chatbotProject.id,
    type: 'budget_threshold',
    severity: 'warning',
    title: 'Monthly Budget Warning Threshold (80%)',
    message: `Project "${chatbotProject.name}" spend reached $${(totalCostSum * 0.65).toFixed(2)} of $450.00 monthly budget.`,
    metadata: { currentSpend: totalCostSum * 0.65, monthlyBudget: 450.0, percentUsed: 82.5 }
  });

  console.log(`✓ Seeded ${totalGenerated} requests successfully.`);
  console.log(`✓ Total estimated seed spend: $${totalCostSum.toFixed(2)}`);
  console.log('\n======================================================');
  console.log('🚀 AI Cost Demo Seed Complete!');
  console.log('------------------------------------------------------');
  console.log('Dashboard:   http://localhost:3000');
  console.log('Gateway:     http://localhost:4000/v1');
  console.log('API Server:  http://localhost:3001');
  console.log('Admin Login: admin@aicost.local (password: password123)');
  console.log(`Demo API Key: ${chatbotRawKey}`);
  console.log('======================================================\n');

  await db.close();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
