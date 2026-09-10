import { getDatabase, Repository } from '@ai-cost/database';
import { buildApiServer } from './server.js';

async function main() {
  const port = parseInt(process.env.API_PORT || '3001', 10);
  const host = process.env.API_HOST || '0.0.0.0';

  console.log('[ai-cost/api] Initializing database connection...');
  const db = await getDatabase();
  const repo = new Repository(db);

  const server = buildApiServer({ repo, logger: true });

  const shutdown = async () => {
    console.log('[ai-cost/api] Shutting down API server gracefully...');
    await server.close();
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await server.listen({ port, host });
    console.log(`[ai-cost/api] AI Cost API server listening at http://${host}:${port}`);
  } catch (err) {
    console.error('[ai-cost/api] Failed to start API server:', err);
    process.exit(1);
  }
}

main();
