import { createHash } from 'node:crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Repository } from '@ai-cost/database';

export interface AuthContext {
  projectId: string;
  organizationId: string;
  keyPrefix: string;
  providerApiKey?: string;
}

export function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey.trim()).digest('hex');
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();

  constructor(private max: number = 10_000, private defaultTtlMs: number = 60_000) {}

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V, ttlMs = this.defaultTtlMs): void {
    if (this.cache.size >= this.max) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const apiKeyCache = new TTLCache<string, any>(10_000, 60_000);

export function invalidateApiKeyCache(hashedKey?: string): void {
  if (hashedKey) {
    apiKeyCache.delete(hashedKey);
  } else {
    apiKeyCache.clear();
  }
}

/**
 * Fastify preHandler to authenticate the request against the AI Cost API keys.
 * Supports:
 * - Authorization: Bearer <ai-cost-key>
 * - x-ai-cost-key: <ai-cost-key>
 * - Also extracts provider key if passed via x-provider-api-key or standard Authorization if x-ai-cost-key is used.
 */
export function createAuthMiddleware(repo: Repository) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers['authorization'];
    const customHeader = request.headers['x-ai-cost-key'] as string | undefined;
    const providerHeader = request.headers['x-provider-api-key'] as string | undefined;

    let aiCostKey = customHeader;
    let providerKey = providerHeader;

    if (!aiCostKey && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token.startsWith('ac_live_') || token.startsWith('ac_test_')) {
        aiCostKey = token;
      } else {
        // Token might be a provider key or master key
        providerKey = token;
      }
    }

    // In dev / test or local mode without key, check if master key or default project allowed
    if (!aiCostKey && process.env.AI_COST_ALLOW_ANONYMOUS === 'true') {
      (request as any).auth = {
        projectId: 'default-project',
        organizationId: 'default-org',
        keyPrefix: 'ac_anon',
        providerApiKey: providerKey
      };
      return;
    }

    if (!aiCostKey) {
      reply.status(401).send({
        error: {
          message: 'Missing AI Cost API key. Provide it via "Authorization: Bearer ac_live_..." or "x-ai-cost-key: ac_live_...".',
          type: 'authentication_error',
          code: 'unauthorized'
        }
      });
      return;
    }

    const hashed = hashKey(aiCostKey);
    let keyRecord = apiKeyCache.get(hashed);

    if (!keyRecord) {
      keyRecord = await repo.getApiKeyByHashedKey(hashed);
      if (!keyRecord) {
        reply.status(401).send({
          error: {
            message: 'Invalid or revoked AI Cost API key.',
            type: 'authentication_error',
            code: 'invalid_api_key'
          }
        });
        return;
      }
      apiKeyCache.set(hashed, keyRecord);
    }

    // Asynchronously update last used
    repo.updateApiKeyLastUsed(keyRecord.id).catch(() => {});

    (request as any).auth = {
      projectId: keyRecord.projectId,
      organizationId: keyRecord.organizationId,
      keyPrefix: keyRecord.keyPrefix,
      providerApiKey: providerKey
    };
  };
}
