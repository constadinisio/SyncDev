import { describe, it, expect, beforeEach } from "vitest";
import { loadConfig, resetConfigForTests, isOriginAllowed } from "./config.js";

const PROD_BASE = {
  NODE_ENV: "production",
  ALLOWED_ORIGINS: "https://app.example.com",
  COLLAB_JWT_SECRET: "x".repeat(32),
} as NodeJS.ProcessEnv;

describe("loadConfig", () => {
  beforeEach(() => resetConfigForTests());

  it("applies dev defaults", () => {
    const cfg = loadConfig({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(cfg.port).toBe(4000);
    expect(cfg.isProduction).toBe(false);
    expect(cfg.authEnforced).toBe(false);
    expect(cfg.allowedOrigins).toContain("http://localhost:3000");
  });

  it("requires ALLOWED_ORIGINS in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        COLLAB_JWT_SECRET: "x".repeat(32),
      } as NodeJS.ProcessEnv),
    ).toThrow(/ALLOWED_ORIGINS/);
  });

  it("rejects wildcard origin in production", () => {
    expect(() => loadConfig({ ...PROD_BASE, ALLOWED_ORIGINS: "*" } as NodeJS.ProcessEnv)).toThrow(
      /ALLOWED_ORIGINS/,
    );
  });

  it("requires COLLAB_JWT_SECRET when auth is enforced", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://a.com" } as NodeJS.ProcessEnv),
    ).toThrow(/COLLAB_JWT_SECRET/);
  });

  it("rejects a short jwt secret", () => {
    expect(() =>
      loadConfig({ ...PROD_BASE, COLLAB_JWT_SECRET: "short" } as NodeJS.ProcessEnv),
    ).toThrow(/at least 32/);
  });

  it("enforces auth by default in production", () => {
    const cfg = loadConfig(PROD_BASE);
    expect(cfg.authEnforced).toBe(true);
    expect(cfg.terminal.useDocker).toBe(true);
  });

  it("rejects invalid integers and booleans", () => {
    expect(() => loadConfig({ NODE_ENV: "development", PORT: "abc" } as NodeJS.ProcessEnv)).toThrow(
      /PORT/,
    );
    expect(() =>
      loadConfig({ NODE_ENV: "development", AUTH_ENFORCED: "maybe" } as NodeJS.ProcessEnv),
    ).toThrow(/AUTH_ENFORCED/);
  });
});

describe("isOriginAllowed", () => {
  beforeEach(() => resetConfigForTests());

  it("matches allowlisted origins exactly", () => {
    const cfg = loadConfig(PROD_BASE);
    expect(isOriginAllowed("https://app.example.com", cfg)).toBe(true);
    expect(isOriginAllowed("https://evil.com", cfg)).toBe(false);
    expect(isOriginAllowed(undefined, cfg)).toBe(false);
  });
});
