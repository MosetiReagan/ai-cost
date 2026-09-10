import { getDatabase, Repository } from '@ai-cost/database';
import { buildServer } from './server.js';
import { UsageQueue } from './queue.js';

async function main() {
  const port = parseInt(process.env.GATEWAY_PORT || '4000', 10);
  const host = process.env.GATEWAY_HOST || '0.0.0.0';

  console.log('[ai-cost/gateway] Initializing database connection...');
  const db = await getDatabase();
  const repo = new Repository(db);
  const queue = new UsageQueue(repo);

  const server = buildServer({ repo, queue, logger: true });

  const shutdown = async () => {
    console.log('[ai-cost/gateway] Shutting down gateway gracefully...');
    await server.close();
    await queue.stop();
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await server.listen({ port, host });
    console.log(`[ai-cost/gateway] AI Cost Gateway listening at http://${host}:${port}`);
    console.log(`[ai-cost/gateway] OpenAI-compatible endpoint: http://${host}:${port}/v1/chat/completions`);
  } catch (err) {
    console.error('[ai-cost/gateway] Failed to start server:', err);
    process.exit(1);
  }
}

main();
