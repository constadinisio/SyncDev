import { describe, it, expect } from "vitest";
import type { IncomingMessage } from "http";
import { RateLimiter, getClientIp } from "./rate-limit.js";

describe("RateLimiter", () => {
  it("allows up to max requests within a window", () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 3 });
    const now = 1_000_000;
    expect(limiter.hit("ip", now).allowed).toBe(true);
    expect(limiter.hit("ip", now).allowed).toBe(true);
    expect(limiter.hit("ip", now).allowed).toBe(true);
    const blocked = limiter.hit("ip", now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks remaining count", () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 2 });
    expect(limiter.hit("ip", 0).remaining).toBe(1);
    expect(limiter.hit("ip", 0).remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 });
    expect(limiter.hit("ip", 0).allowed).toBe(true);
    expect(limiter.hit("ip", 500).allowed).toBe(false);
    expect(limiter.hit("ip", 1000).allowed).toBe(true);
  });

  it("isolates keys", () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 });
    expect(limiter.hit("a", 0).allowed).toBe(true);
    expect(limiter.hit("b", 0).allowed).toBe(true);
    expect(limiter.hit("a", 0).allowed).toBe(false);
  });

  it("sweeps expired buckets", () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 });
    limiter.hit("a", 0);
    limiter.sweep(2000);
    // After sweep the key is fresh again.
    expect(limiter.hit("a", 2000).allowed).toBe(true);
  });

  it("keeps unexpired buckets during a sweep", () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 });
    limiter.hit("a", 0);
    limiter.sweep(500); // within the window — bucket survives
    expect(limiter.hit("a", 500).allowed).toBe(false);
  });
});

describe("getClientIp", () => {
  it("prefers the first X-Forwarded-For entry", () => {
    const req = {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      socket: { remoteAddress: "10.0.0.1" },
    } as unknown as IncomingMessage;
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to the socket address", () => {
    const req = {
      headers: {},
      socket: { remoteAddress: "10.0.0.1" },
    } as unknown as IncomingMessage;
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when nothing is available", () => {
    const req = { headers: {}, socket: {} } as unknown as IncomingMessage;
    expect(getClientIp(req)).toBe("unknown");
  });
});
