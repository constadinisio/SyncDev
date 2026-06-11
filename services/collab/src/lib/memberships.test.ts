import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { AuthUser } from "./auth.js";

const userA: AuthUser = { id: "user-a" };
const userB: AuthUser = { id: "user-b" };

let mod: typeof import("./memberships.js");
let tmpDir: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "syncdev-memberships-"));
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://app.example.com";
  process.env.COLLAB_JWT_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AUTH_ENFORCED = "true";
  process.env.MEMBERSHIPS_FILE = join(tmpDir, "memberships.json");

  mod = await import("./memberships.js");
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("ensureProjectAccess (TOFU ownership)", () => {
  it("lets the first user claim an unowned project", () => {
    expect(() => mod.ensureProjectAccess("proj-1", userA)).not.toThrow();
    expect(mod.getMembership("proj-1")?.owner).toBe("user-a");
  });

  it("denies a different user once owned", () => {
    expect(() => mod.ensureProjectAccess("proj-1", userB)).toThrow(mod.ForbiddenError);
  });

  it("allows the owner again", () => {
    expect(() => mod.ensureProjectAccess("proj-1", userA)).not.toThrow();
  });

  it("allows an explicitly added member", () => {
    mod.addMember("proj-1", "user-a", "user-b");
    expect(() => mod.ensureProjectAccess("proj-1", userB)).not.toThrow();
  });

  it("only the owner may add members", () => {
    expect(() => mod.addMember("proj-1", "user-b", "user-c")).toThrow(mod.ForbiddenError);
  });

  it("is a no-op when there is no authenticated user", () => {
    expect(() => mod.ensureProjectAccess("proj-2", null)).not.toThrow();
    // No record is created when user is null.
    expect(mod.getMembership("proj-2")).toBeNull();
  });
});

describe("filterAccessibleProjects", () => {
  it("filters to owned/member/unowned projects", () => {
    mod.ensureProjectAccess("owned-by-a", userA);
    const visible = mod.filterAccessibleProjects(
      ["owned-by-a", "proj-1", "unowned-x"],
      userB,
    );
    // userB is a member of proj-1 and unowned-x is claimable; owned-by-a is hidden.
    expect(visible).toContain("proj-1");
    expect(visible).toContain("unowned-x");
    expect(visible).not.toContain("owned-by-a");
  });
});
