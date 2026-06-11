import type { NextMiddleware } from "next/server";
import { auth, authEnabled } from "@/auth";

/**
 * Protects application pages when auth is enabled. Unauthenticated users are
 * redirected to the sign-in page. Auth.js routes and the collab-token endpoint
 * stay public. When AUTH_ENABLED is not set, this is a no-op (dev mode).
 *
 * The cast works around TS2742 (NextAuth v5's wrapped-handler type is not
 * portable across npm workspaces); the runtime shape matches NextMiddleware.
 */
const middleware = auth((req) => {
  if (!authEnabled) return;

  const { pathname } = req.nextUrl;
  const isPublic =
    pathname.startsWith("/api/auth") || pathname.startsWith("/api/collab-token");

  if (!req.auth && !isPublic) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return Response.redirect(signInUrl);
  }
}) as unknown as NextMiddleware;

export default middleware;

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
