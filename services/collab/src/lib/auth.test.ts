import { describe, it, expect, beforeAll } from "vitest";
import type { IncomingMessage } from "http";

const SECRET = "0123456789abcdef0123456789abcdef";

// Configure the environment before importing modules that read config at load.
let authMod: typeof import("./auth.js");
let mintToken: (claims: Record<string, unknown>, opts?: { issuer?: string; audience?: string; expired?: boolean }) => Promise<string>;

beforeAll(async () => {
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://app.example.com";
  process.env.COLLAB_JWT_SECRET = SECRET;
  process.env.AUTH_ENFORCED = "true";

  authMod = await import("./auth.js");
  const { SignJWT } = await import("jose");
  const key = new TextEncoder().encode(SECRET);

  mintToken = async (claims, opts = {}) => {
    const builder = new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(opts.issuer ?? "syncdev-web")
      .setAudience(opts.audience ?? "syncdev-collab")
      .setIssuedAt();
    builder.setExpirationTime(opts.expired ? "-1h" : "1h");
    return builder.sign(key);
  };
});

describe("verifyToken", () => {
  it("verifies a valid token and returns the user", async () => {
    const token = await mintToken({ sub: "user-1", email: "a@b.com", name: "A" });
    const user = await authMod.verifyToken(token);
    expect(user).toEqual({ id: "user-1", email: "a@b.com", name: "A" });
  });

  it("rejects a token signed with the wrong secret", async () => {
    const { SignJWT } = await import("jose");
    const bad = await new SignJWT({ sub: "u" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("syncdev-web")
      .setAudience("syncdev-collab")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("wrong-secret-wrong-secret-wrong!!"));
    expect(await authMod.verifyToken(bad)).toBeNull();
  });

  it("rejects a token with the wrong audience", async () => {
    const token = await mintToken({ sub: "u" }, { audience: "someone-else" });
    expect(await authMod.verifyToken(token)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await mintToken({ sub: "u" }, { expired: true });
    expect(await authMod.verifyToken(token)).toBeNull();
  });

  it("returns null for missing/empty tokens", async () => {
    expect(await authMod.verifyToken(undefined)).toBeNull();
    expect(await authMod.verifyToken("")).toBeNull();
  });
});

describe("extractToken", () => {
  it("reads a Bearer Authorization header", () => {
    const req = { headers: { authorization: "Bearer abc.def" }, url: "/x" } as IncomingMessage;
    expect(authMod.extractToken(req)).toBe("abc.def");
  });

  it("reads a token query param", () => {
    const req = { headers: {}, url: "/room?token=qqq" } as unknown as IncomingMessage;
    expect(authMod.extractToken(req)).toBe("qqq");
  });

  it("returns undefined when no token is present", () => {
    const req = { headers: {}, url: "/room" } as unknown as IncomingMessage;
    expect(authMod.extractToken(req)).toBeUndefined();
  });
});

describe("authenticate", () => {
  it("throws AuthRequiredError when enforced and no token", async () => {
    const req = { headers: {}, url: "/x" } as unknown as IncomingMessage;
    await expect(authMod.authenticate(req)).rejects.toBeInstanceOf(authMod.AuthRequiredError);
  });

  it("returns the user when a valid token is present", async () => {
    const token = await mintToken({ sub: "user-9" });
    const req = {
      headers: { authorization: `Bearer ${token}` },
      url: "/x",
    } as IncomingMessage;
    const user = await authMod.authenticate(req);
    expect(user?.id).toBe("user-9");
  });
});
