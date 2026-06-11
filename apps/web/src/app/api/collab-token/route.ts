import { SignJWT } from "jose";
import { auth, authEnabled } from "@/auth";

/**
 * Mints a short-lived HS256 token the browser presents to the collab service.
 * The collab service verifies it with the same COLLAB_JWT_SECRET. Identity
 * comes from the authenticated Auth.js session.
 */
export async function GET(): Promise<Response> {
  // In dev open mode there is nothing to mint; the collab service is open too.
  if (!authEnabled) {
    return Response.json({ token: null });
  }

  const session = await auth();
  const user = session?.user as { id?: string; email?: string; name?: string } | undefined;
  if (!user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const secret = process.env.COLLAB_JWT_SECRET;
  if (!secret) {
    return Response.json({ error: "collab auth not configured" }, { status: 500 });
  }

  const key = new TextEncoder().encode(secret);
  const token = await new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("syncdev-web")
    .setAudience("syncdev-collab")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  return Response.json({ token });
}
