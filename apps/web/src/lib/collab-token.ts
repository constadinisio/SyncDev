"use client";

/**
 * Client-side cache for the collab service token.
 *
 * The token is minted by /api/collab-token from the Auth.js session and is
 * short-lived (1h). We refresh it a minute before expiry. When auth is
 * disabled (dev), there is no token and the collab service is open.
 */

const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
const REFRESH_MARGIN_MS = 60_000;
const ASSUMED_TTL_MS = 50 * 60_000; // refresh well before the 1h server expiry

interface CachedToken {
  readonly token: string;
  readonly expiresAt: number;
}

let cache: CachedToken | null = null;
let inFlight: Promise<string | null> | null = null;

/** Returns a valid token, fetching/refreshing as needed. Null when auth is off. */
export async function getCollabToken(): Promise<string | null> {
  if (!AUTH_ENABLED) return null;

  if (cache && cache.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
    return cache.token;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/collab-token", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as { token: string | null };
      if (!data.token) return null;
      cache = { token: data.token, expiresAt: Date.now() + ASSUMED_TTL_MS };
      return data.token;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Returns the cached token synchronously (or null). Used where async is not possible. */
export function getCachedCollabToken(): string | null {
  if (!AUTH_ENABLED) return null;
  if (cache && cache.expiresAt > Date.now()) return cache.token;
  return null;
}

/** Whether the client should attach auth to collab requests. */
export function isAuthEnabled(): boolean {
  return AUTH_ENABLED;
}
