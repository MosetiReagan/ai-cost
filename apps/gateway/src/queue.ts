import { AIRequestUsage } from '@ai-cost/types';
import { Repository } from '@ai-cost/database';

export class UsageQueue {
  private queue: AIRequestUsage[] = [];
  private timer: any = null;
  private batchSize: number = 20;
  private flushIntervalMs: number = 1000;
  private isFlushing: boolean = false;

  constructor(private repo: Repository) {
    this.timer = setInterval(() => {
      this.flush().catch(err => {
        console.error('[ai-cost/gateway] Background queue flush error:', err);
      });
    }, this.flushIntervalMs);

    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  enqueue(usage: AIRequestUsage): void {
    this.queue.push(usage);
    if (this.queue.length >= this.batchSize) {
      setImmediate(() => {
        this.flush().catch(err => {
          console.error('[ai-cost/gateway] Immediate queue flush error:', err);
        });
      });
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const items = [...this.queue];
    this.queue = [];

    try {
      await this.repo.batchRecordRequests(items);
    } catch (err) {
      console.error('[ai-cost/gateway] Failed to record usage batch:', (err as Error).message);
      // If fail open, we do not throw. But we could put back items up to a reasonable cap
      if (items.length < 500) {
        this.queue.unshift(...items);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.flush();
  }
}
