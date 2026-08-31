const ONE_HOUR_MS = 60 * 60 * 1_000;

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface RateBucket {
  count: number;
  startedAt: number;
}

/**
 * A bounded, per-process limiter for the synthetic public demo. The reverse
 * proxy remains the right place for a distributed/global edge limit; this
 * guard prevents one client from writing an unbounded amount to one API
 * process even if that edge policy is absent.
 */
export class PublicWriteRateLimiter {
  private readonly buckets = new Map<string, RateBucket>();
  private lastPrunedAt = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs = ONE_HOUR_MS,
    private readonly maxTrackedClients = 5_000,
    private readonly clock: () => number = Date.now
  ) {}

  consume(clientKey: string): RateLimitDecision {
    const timestamp = this.clock();
    this.pruneExpired(timestamp);

    // Do not let a stream of spoofed client identifiers grow the limiter map.
    // Once full, unseen identifiers share one deliberately conservative bucket.
    const boundedKey = this.buckets.has(clientKey) || this.buckets.size < this.maxTrackedClients
      ? clientKey
      : "__overflow__";
    let bucket = this.buckets.get(boundedKey);
    if (!bucket || timestamp - bucket.startedAt >= this.windowMs) {
      bucket = { count: 0, startedAt: timestamp };
      this.buckets.set(boundedKey, bucket);
    }
    bucket.count += 1;
    return {
      allowed: bucket.count <= this.limit,
      limit: this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      resetAt: bucket.startedAt + this.windowMs
    };
  }

  private pruneExpired(timestamp: number): void {
    if (this.buckets.size < this.maxTrackedClients) return;
    if (timestamp - this.lastPrunedAt < Math.min(this.windowMs, 60_000)) return;
    this.lastPrunedAt = timestamp;
    for (const [key, bucket] of this.buckets) {
      if (timestamp - bucket.startedAt >= this.windowMs) this.buckets.delete(key);
    }
  }
}

export class SseConnectionLimiter {
  private readonly counts = new Map<string, number>();
  private total = 0;

  constructor(
    private readonly perClientLimit: number,
    private readonly globalLimit: number
  ) {}

  acquire(clientKey: string): (() => void) | undefined {
    const clientCount = this.counts.get(clientKey) ?? 0;
    if (clientCount >= this.perClientLimit || this.total >= this.globalLimit) return undefined;

    this.counts.set(clientKey, clientCount + 1);
    this.total += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = this.counts.get(clientKey) ?? 0;
      if (current <= 1) this.counts.delete(clientKey);
      else this.counts.set(clientKey, current - 1);
      this.total = Math.max(0, this.total - 1);
    };
  }

  get activeTotal(): number {
    return this.total;
  }
}
