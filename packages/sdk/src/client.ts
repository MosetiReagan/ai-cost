import { randomUUID } from 'node:crypto';
import { ProviderType } from '@ai-cost/types';

export interface AICostOptions {
  apiKey?: string;
  baseUrl?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  failOpen?: boolean;
  debug?: boolean;
}

interface QueuedEvent {
  payload: any;
  attempts: number;
}

export interface TrackRequestParams {
  requestId?: string;
  provider: ProviderType;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  latencyMs: number;
  statusCode?: number;
  status?: 'success' | 'error';
  errorMessage?: string;
  tags?: Record<string, string>;
  userId?: string;
  environment?: string;
  timestamp?: Date;
}

export class AICost {
  private apiKey: string;
  private baseUrl: string;
  private batchSize: number;
  private flushIntervalMs: number;
  private maxRetries: number;
  private retryBackoffMs: number;
  private failOpen: boolean;
  private debug: boolean;
  private queue: QueuedEvent[] = [];
  private timer: any = null;
  private isFlushing = false;
  private retryDelayMs = 0;

  constructor(options: AICostOptions = {}) {
    this.apiKey = options.apiKey || process.env.AI_COST_API_KEY || '';
    this.baseUrl = (options.baseUrl || process.env.AI_COST_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
    this.batchSize = options.batchSize ?? 10;
    this.flushIntervalMs = options.flushIntervalMs ?? 2000;
    this.maxRetries = options.maxRetries ?? 5;
    this.retryBackoffMs = options.retryBackoffMs ?? 500;
    this.failOpen = options.failOpen ?? true;
    this.debug = options.debug ?? false;

    if (typeof window === 'undefined') {
      this.startFlushTimer();
    }
  }

  private startFlushTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.queue.length > 0 && !this.isFlushing) {
        this.flush().catch(err => {
          if (this.debug) console.error('[ai-cost/sdk] Flush error:', err);
        });
      }
    }, this.flushIntervalMs);

    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  /**
   * Returns current pending queue length.
   */
  get queueLength(): number {
    return this.queue.length;
  }

  /**
   * Tracks an AI request usage event.
   */
  async track(params: TrackRequestParams): Promise<void> {
    const payload = {
      requestId: params.requestId || randomUUID(),
      provider: params.provider,
      model: params.model,
      inputTokens: Math.max(0, params.inputTokens),
      outputTokens: Math.max(0, params.outputTokens),
      cachedTokens: Math.max(0, params.cachedTokens || 0),
      totalTokens: Math.max(0, params.inputTokens + params.outputTokens),
      latencyMs: Math.max(0, params.latencyMs),
      statusCode: params.statusCode ?? 200,
      status: params.status || (params.errorMessage ? 'error' : 'success'),
      errorMessage: params.errorMessage,
      tags: params.tags,
      userId: params.userId,
      environment: params.environment || process.env.NODE_ENV || 'production',
      timestamp: (params.timestamp || new Date()).toISOString()
    };

    this.queue.push({ payload, attempts: 0 });

    if (this.queue.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flushes all queued usage events to the AI Cost backend with retry support.
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const batch = this.queue.splice(0, this.queue.length);
    const itemsToSend = batch.map(item => item.payload);

    try {
      const endpoint = `${this.baseUrl}/api/usage/track`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ batch: itemsToSend })
      });

      if (!res.ok) {
        throw new Error(`Failed to send AI Cost usage: HTTP ${res.status} ${res.statusText}`);
      }

      // Reset retry delay on success
      this.retryDelayMs = 0;
    } catch (err) {
      if (this.debug) {
        console.error('[ai-cost/sdk] Failed to flush events to AI Cost:', err);
      }

      // Re-queue items that have not exceeded maxRetries
      const retryItems: QueuedEvent[] = [];
      let minAttempts = Infinity;

      for (const item of batch) {
        const nextAttempts = item.attempts + 1;
        if (nextAttempts < this.maxRetries) {
          retryItems.push({ payload: item.payload, attempts: nextAttempts });
          if (nextAttempts < minAttempts) {
            minAttempts = nextAttempts;
          }
        } else if (this.debug) {
          console.warn(`[ai-cost/sdk] Event ${item.payload.requestId} dropped after exceeding ${this.maxRetries} retry attempts`);
        }
      }

      if (retryItems.length > 0) {
        this.queue.unshift(...retryItems);
        this.retryDelayMs = Math.min(this.retryBackoffMs * Math.pow(2, minAttempts - 1), 30000);
      }

      if (!this.failOpen) {
        throw err;
      }
    } finally {
      this.isFlushing = false;
    }
  }
}
