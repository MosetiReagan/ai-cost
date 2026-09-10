import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { SCHEMA_SQL } from './schema.js';

export interface QueryResult<T = any> {
  rows: T[];
}

export interface IDatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
  isPGlite?: boolean;
}

class PGliteDatabaseClient implements IDatabaseClient {
  private pglite: PGlite;
  public isPGlite = true;

  constructor(pglite: PGlite) {
    this.pglite = pglite;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    if (!params || params.length === 0) {
      // Use exec for multi-statement DDL/DML scripts
      const results = await this.pglite.exec(sql);
      const last = results[results.length - 1];
      return { rows: last ? (last.rows as any) : [] };
    }
    const res = await this.pglite.query<T>(sql, params);
    return { rows: res.rows };
  }

  async close(): Promise<void> {
    await this.pglite.close();
  }
}

class PgPoolDatabaseClient implements IDatabaseClient {
  private pool: pg.Pool;
  public isPGlite = false;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const res = await this.pool.query(sql, params);
    return { rows: res.rows };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

let singletonClient: IDatabaseClient | null = null;

export async function createDatabaseClient(connectionUrl?: string): Promise<IDatabaseClient> {
  const url = connectionUrl || process.env.DATABASE_URL;

  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    try {
      const pool = new pg.Pool({
        connectionString: url,
        connectionTimeoutMillis: 3000,
      });
      await pool.query('SELECT 1');
      const client = new PgPoolDatabaseClient(pool);
      await client.query(SCHEMA_SQL);
      return client;
    } catch (err) {
      console.warn(`[ai-cost/database] Failed to connect to PostgreSQL at ${url}. Falling back to embedded PGlite engine. Error:`, (err as Error).message);
    }
  }

  // Fallback to embedded PGlite (in-memory or data dir)
  const pglite = new PGlite(process.env.PGLITE_DATA_DIR || undefined);
  const client = new PGliteDatabaseClient(pglite);
  await client.query(SCHEMA_SQL);
  return client;
}

export async function getDatabase(connectionUrl?: string): Promise<IDatabaseClient> {
  if (!singletonClient) {
    singletonClient = await createDatabaseClient(connectionUrl);
  }
  return singletonClient;
}

export async function closeDatabase(): Promise<void> {
  if (singletonClient) {
    await singletonClient.close();
    singletonClient = null;
  }
}
