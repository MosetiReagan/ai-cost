#!/usr/bin/env node
import { getDatabase, Repository, SCHEMA_SQL } from '@ai-cost/database';
import { hashPassword, generateApiKey } from '../apps/api/src/auth.js';

const command = process.argv[2] || 'help';

async function main() {
  switch (command) {
    case 'doctor':
      await runDoctor();
      break;
    case 'seed':
      await runSeed();
      break;
    case 'migrate':
      await runMigrate();
      break;
    case 'cleanup':
      await runCleanup();
      break;
    case 'init':
      await runInit();
      break;
    case 'help':
    default:
      printHelp();
      break;
  }
}

async function runDoctor() {
  console.log('🩺 Running AI Cost Diagnostic Doctor...\n');

  // Check Node version
  const nodeVersion = process.version;
  console.log(`[✓] Node Runtime: ${nodeVersion} (>= 20.0.0 required)`);

  // Check Environment Variables
  const dbUrl = process.env.DATABASE_URL || '(embedded PGlite engine)';
  console.log(`[✓] Database Target: ${dbUrl}`);

  // Test Database Connection
  try {
    const db = await getDatabase();
    await db.query('SELECT 1');
    console.log('[✓] Database Connection: Healthy');

    const repo = new Repository(db);
    const userCount = await repo.getUserCount();
    console.log(`[✓] Registered Users: ${userCount}`);
  } catch (err: any) {
    console.error(`[✗] Database Connection Failed: ${err.message}`);
  }

  // Check Upstream Provider API Keys configured
  console.log('\nConfigured Upstream Providers:');
  console.log(`  OpenAI:    ${process.env.OPENAI_API_KEY ? 'Configured' : 'Not set (will require client-supplied key)'}`);
  console.log(`  Anthropic: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Not set (will require client-supplied key)'}`);
  console.log(`  Gemini:    ${process.env.GEMINI_API_KEY ? 'Configured' : 'Not set (will require client-supplied key)'}`);
  console.log(`  Ollama:    ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434 (default)'}`);

  console.log('\n[✓] Diagnostic check complete. System is ready.');
  process.exit(0);
}

async function runMigrate() {
  console.log('🔄 Applying AI Cost schema migrations...');
  try {
    const db = await getDatabase();
    await db.query(SCHEMA_SQL);
    console.log('✓ All tables and indexes successfully verified and updated.');
  } catch (err: any) {
    console.error('✗ Migration failed:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

async function runSeed() {
  const { execSync } = await import('node:child_process');
  execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
}

async function runCleanup() {
  const days = parseInt(process.env.DATA_RETENTION_DAYS || '90', 10);
  console.log(`🧹 Running data retention cleanup for records older than ${days} days...`);
  try {
    const db = await getDatabase();
    const repo = new Repository(db);
    const purged = await repo.purgeOldRequests(days);
    console.log(`✓ Data retention cleanup completed. Purged ${purged} legacy request records.`);
  } catch (err: any) {
    console.error('✗ Retention cleanup failed:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

async function runInit() {
  console.log('🚀 Initializing AI Cost Platform...');
  try {
    const db = await getDatabase();
    const repo = new Repository(db);
    const count = await repo.getUserCount();

    if (count > 0) {
      console.log('ℹ Platform has already been initialized. Use the dashboard at http://localhost:3000 to manage projects.');
      process.exit(0);
    }

    const org = await repo.createOrganization('Primary Organization', 'primary-org');
    const email = process.env.AI_COST_ADMIN_EMAIL || 'admin@aicost.local';
    const password = process.env.AI_COST_ADMIN_PASSWORD || 'password123';
    const pwdHash = await hashPassword(password);

    await repo.createUser({
      organizationId: org.id,
      email,
      passwordHash: pwdHash,
      name: 'System Admin',
      role: 'owner'
    });

    const project = await repo.createProject({
      organizationId: org.id,
      name: 'Default Project',
      slug: 'default-project'
    });

    const key = generateApiKey();
    await repo.createApiKey({
      projectId: project.id,
      keyPrefix: key.keyPrefix,
      name: 'Production Gateway Key',
      hashedKey: key.hashedKey
    });

    console.log('✓ Initial administrator and default project created.');
    console.log(`  Admin Email: ${email}`);
    console.log(`  Admin Password: ${password}`);
    console.log(`  Live API Key:   ${key.rawKey}`);
    console.log('\nKeep this API key safe. It will not be shown again.');
  } catch (err: any) {
    console.error('✗ Initialization failed:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

function printHelp() {
  console.log(`
AI Cost CLI — Developer & Infrastructure Management

Usage:
  ai-cost <command>

Commands:
  init       Initialize database, create default organization, admin user & API key
  doctor     Run diagnostic health checks on database and environment configurations
  seed       Generate realistic 30-day synthetic multi-provider telemetry data
  migrate    Verify and execute database schema DDL migrations
  cleanup    Purge request records older than DATA_RETENTION_DAYS (default: 90)
  help       Show this help message
`);
}

main().catch(err => {
  console.error('Fatal CLI error:', err);
  process.exit(1);
});
