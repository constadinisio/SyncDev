import type { IncomingMessage } from "http";

/**
 * Minimal in-memory fixed-window rate limiter keyed by client identity.
 *
 * Suitable for a single-node deployment (our current target). For multi-node
 * you'd back this with Redis, but the public surface here would stay the same.
 */

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  readonly windowMs: number;
  /** Max requests allowed per key within the window. */
  readonly max: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  /** Remaining requests in the current window. */
  readonly remaining: number;
  /** Unix epoch ms when the current window resets. */
  readonly resetAt: number;
}

interface Counter {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Counter>();
  private readonly windowMs: number;
  private readonly max: number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
  }

  /** Records a hit for `key` and reports whether it is within the limit. */
  hit(key: string, now: number): RateLimitResult {
    const existing = this.buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.max - 1, resetAt };
    }

    if (existing.count >= this.max) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: this.max - existing.count,
      resetAt: existing.resetAt,
    };
  }

  /** Drops expired buckets to bound memory. Call periodically. */
  sweep(now: number): void {
    for (const [key, counter] of this.buckets) {
      if (now >= counter.resetAt) this.buckets.delete(key);
    }
  }
}

/**
 * Best-effort client IP extraction. Honors X-Forwarded-For when present
 * (we sit behind a reverse proxy in production), else the socket address.
 */
export function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}
