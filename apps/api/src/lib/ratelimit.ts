// In-memory sliding-window rate limiter keyed by an arbitrary string (IP, user id, ...).
interface Bucket {
  tokens: number;
  updated: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private capacity: number;
  private refillPerMs: number;

  /** @param capacity max burst; @param perMinute sustained rate */
  constructor(capacity: number, perMinute: number) {
    this.capacity = capacity;
    this.refillPerMs = perMinute / 60_000;
    setInterval(() => this.sweep(), 60_000).unref();
  }

  /** Returns true when the request is allowed. */
  take(key: string, cost = 1): boolean {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.capacity, updated: now };
      this.buckets.set(key, b);
    }
    b.tokens = Math.min(this.capacity, b.tokens + (now - b.updated) * this.refillPerMs);
    b.updated = now;
    if (b.tokens < cost) return false;
    b.tokens -= cost;
    return true;
  }

  private sweep() {
    const cutoff = Date.now() - 10 * 60_000;
    for (const [k, b] of this.buckets) if (b.updated < cutoff) this.buckets.delete(k);
  }
}
