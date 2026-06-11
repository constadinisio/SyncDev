import type { IncomingMessage } from "http";
import { jwtVerify, type JWTPayload } from "jose";
import { loadConfig } from "./config.js";
import { logError } from "./logger.js";

/**
 * Cross-service authentication for the collab server.
 *
 * The web app (Auth.js) mints a short-lived HS256 JWT signed with the shared
 * COLLAB_JWT_SECRET and hands it to the browser, which presents it on every
 * REST request (Authorization: Bearer) and on the WebSocket upgrade (?token=).
 * Here we only verify it — we never issue or store sessions.
 */

const config = loadConfig();
const JWT_ISSUER = "syncdev-web";
const JWT_AUDIENCE = "syncdev-collab";

const secretKey = config.collabJwtSecret ? new TextEncoder().encode(config.collabJwtSecret) : null;

export interface AuthUser {
  readonly id: string;
  readonly email?: string;
  readonly name?: string;
}

/** True when requests must be authenticated. */
export function isAuthEnforced(): boolean {
  return config.authEnforced;
}

function toAuthUser(payload: JWTPayload): AuthUser | null {
  if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
  return {
    id: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}

/** Verifies a bearer token, returning the user or null if invalid/expired. */
export async function verifyToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token || !secretKey) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return toAuthUser(payload);
  } catch (err) {
    // Expected for tampered/expired tokens — log at debug level only.
    if (config.nodeEnv !== "production") {
      logError("auth", "token verification failed", err);
    }
    return null;
  }
}

/** Extracts a token from the Authorization header or the `token` query param. */
export function extractToken(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  const url = req.url ?? "";
  const queryIndex = url.indexOf("?");
  if (queryIndex !== -1) {
    const params = new URLSearchParams(url.slice(queryIndex + 1));
    const token = params.get("token");
    if (token) return token;
  }
  return undefined;
}

/**
 * Resolves the authenticated user for a request. Returns:
 *  - the user when a valid token is present,
 *  - null when no/invalid token AND auth is not enforced (dev open mode),
 *  - throws AuthRequiredError when auth is enforced and the token is missing/invalid.
 */
export async function authenticate(req: IncomingMessage): Promise<AuthUser | null> {
  const user = await verifyToken(extractToken(req));
  if (user) return user;
  if (config.authEnforced) {
    throw new AuthRequiredError();
  }
  return null;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("authentication required");
    this.name = "AuthRequiredError";
  }
}
