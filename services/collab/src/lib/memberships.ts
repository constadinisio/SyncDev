import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs";
import { dirname, join } from "path";
import { loadConfig } from "./config.js";
import { logError } from "./logger.js";
import type { AuthUser } from "./auth.js";

/**
 * Project-level authorization for a single-node deployment.
 *
 * Membership is persisted as one JSON file next to the snapshot storage. The
 * first authenticated user to open an unowned project claims ownership;
 * everyone else needs to be an explicit member. This is the enforcement
 * primitive — a sharing UI can layer on top later.
 */

interface Membership {
  owner: string;
  members: string[];
}

type MembershipMap = Record<string, Membership>;

const config = loadConfig();
const STORE_PATH =
  process.env.MEMBERSHIPS_FILE ?? join(dirname(config.snapshotDir), "memberships.json");

function readStore(): MembershipMap {
  if (!existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf-8")) as MembershipMap;
  } catch (err) {
    logError("memberships", "failed to read store, treating as empty", err);
    return {};
  }
}

function writeStore(map: MembershipMap): void {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // Write to a temp file then atomically rename, so a crash mid-write can
  // never leave a torn store.
  const tmp = `${STORE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(map, null, 2), "utf-8");
  renameSync(tmp, STORE_PATH);
}

function hasAccess(membership: Membership, userId: string): boolean {
  return membership.owner === userId || membership.members.includes(userId);
}

/** Returns the membership record for a project, or null if unowned. */
export function getMembership(projectId: string): Membership | null {
  return readStore()[projectId] ?? null;
}

export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Ensures `user` may access `projectId`.
 *
 * - When auth is not enforced (dev) or `user` is null, access is allowed.
 * - When the project is unowned, the user claims ownership (TOFU).
 * - Otherwise the user must be the owner or a member, else ForbiddenError.
 */
export function ensureProjectAccess(projectId: string, user: AuthUser | null): void {
  if (!config.authEnforced || !user) return;

  const store = readStore();
  const existing = store[projectId];

  if (!existing) {
    store[projectId] = { owner: user.id, members: [] };
    writeStore(store);
    return;
  }

  if (!hasAccess(existing, user.id)) {
    throw new ForbiddenError();
  }
}

/** Adds a member to a project. Only the owner may invite. */
export function addMember(projectId: string, ownerId: string, memberId: string): void {
  const store = readStore();
  const existing = store[projectId];
  if (!existing || existing.owner !== ownerId) {
    throw new ForbiddenError("only the owner can add members");
  }
  if (!existing.members.includes(memberId) && memberId !== ownerId) {
    existing.members = [...existing.members, memberId];
    writeStore(store);
  }
}

/** Filters a list of project IDs to those the user may access. */
export function filterAccessibleProjects(
  projectIds: readonly string[],
  user: AuthUser | null,
): string[] {
  if (!config.authEnforced || !user) return [...projectIds];
  const store = readStore();
  return projectIds.filter((id) => {
    const m = store[id];
    // Unowned projects remain visible so they can be claimed on first open.
    return !m || hasAccess(m, user.id);
  });
}
