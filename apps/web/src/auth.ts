import NextAuth, { type NextAuthResult } from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Login is GitHub OAuth (fits the app's existing GitHub integration) with a
 * stateless JWT session — no database required, suiting the single-node
 * deployment. The session only carries identity; the collab service is
 * authorized separately via a short-lived shared-secret token minted in
 * /api/collab-token.
 *
 * Auth is opt-in via AUTH_ENABLED so local development stays frictionless.
 */
export const authEnabled = process.env.AUTH_ENABLED === "true";

// Annotate the destructured exports with NextAuthResult member types to avoid
// TS2742 ("inferred type cannot be named") in this npm-workspaces setup.
const nextAuth = NextAuth({
  trustHost: true,
  // Only register the provider when credentials are configured, so the app
  // still boots in dev without OAuth secrets.
  providers: authEnabled && process.env.AUTH_GITHUB_ID ? [GitHub] : [],
  session: { strategy: "jwt" },
  callbacks: {
    // Persist the stable provider account id onto the token.
    jwt({ token, profile }) {
      if (profile?.id) token.sub = String(profile.id);
      return token;
    },
    // Expose the user id to the session consumed by the app.
    session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
});

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
