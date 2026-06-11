import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as Y from "yjs";
import type { Room } from "../types/index.js";

let mod: typeof import("./disk-sync.js");
let snapshotMod: typeof import("./snapshot-store.js");
let fileTreeMod: typeof import("../api/file-tree.js");
let tmpDir: string;
let workspacesDir: string;

/** Creates a minimal Room-shaped object sufficient for disk-sync tests. */
function makeRoom(id: string, content: string, dirty = false): Room {
  const doc = new Y.Doc();
  doc.getText("content").insert(0, content);
  return {
    id,
    doc,
    clients: new Set(),
    awareness: {} as Room["awareness"],
    updateLog: [],
    persistTimer: null,
    destroyTimer: null,
    dirty,
  };
}

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "syncdev-disksync-"));
  workspacesDir = join(tmpDir, "workspaces");
  process.env.NODE_ENV = "test";
  process.env.SNAPSHOT_DIR = join(tmpDir, "snapshots");
  process.env.PROJECTS_DIR = join(tmpDir, "projects");
  process.env.TERMINAL_WORKSPACE_DIR = workspacesDir;

  mod = await import("./disk-sync.js");
  snapshotMod = await import("./snapshot-store.js");
  fileTreeMod = await import("../api/file-tree.js");
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── syncRoomToDisk ──────────────────────────────────────────────────────────

describe("syncRoomToDisk", () => {
  it("skips internal chat rooms (no file written)", () => {
    const room = makeRoom("proj-sync::__chat__stuff", "hello");
    mod.syncRoomToDisk(room);
    const safeId = "proj-sync";
    const filePath = join(workspacesDir, safeId, "__chat__stuff");
    expect(existsSync(filePath)).toBe(false);
  });

  it("skips rooms without a :: separator", () => {
    const room = makeRoom("no-separator-room", "data");
    mod.syncRoomToDisk(room);
    // Nothing should be written
    expect(existsSync(join(workspacesDir, "no-separator-room"))).toBe(false);
  });

  it("writes Y.Doc text content to the correct file path", () => {
    const room = makeRoom("myproject::src/index.ts", "export const x = 1;\n");
    mod.syncRoomToDisk(room);
    const filePath = join(workspacesDir, "myproject", "src", "index.ts");
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf-8")).toBe("export const x = 1;\n");
  });

  it("writes a file at the workspace root (single path segment)", () => {
    const room = makeRoom("rootproj::README.md", "# Hello\n");
    mod.syncRoomToDisk(room);
    const filePath = join(workspacesDir, "rootproj", "README.md");
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf-8")).toBe("# Hello\n");
  });

  it("creates intermediate directories automatically", () => {
    const room = makeRoom("dirtest::a/b/c/deep.ts", "deep");
    mod.syncRoomToDisk(room);
    const filePath = join(workspacesDir, "dirtest", "a", "b", "c", "deep.ts");
    expect(existsSync(filePath)).toBe(true);
  });

  it("overwrites an existing file with new content", () => {
    const room1 = makeRoom("overwrite-proj::file.ts", "v1");
    mod.syncRoomToDisk(room1);
    const room2 = makeRoom("overwrite-proj::file.ts", "v2");
    mod.syncRoomToDisk(room2);
    const filePath = join(workspacesDir, "overwrite-proj", "file.ts");
    expect(readFileSync(filePath, "utf-8")).toBe("v2");
  });
});

// ─── syncAllDirtyRoomsToDisk ─────────────────────────────────────────────────

describe("syncAllDirtyRoomsToDisk", () => {
  it("does nothing for an empty rooms map", () => {
    expect(() => mod.syncAllDirtyRoomsToDisk(new Map())).not.toThrow();
  });

  it("only syncs dirty file rooms", () => {
    const dirty = makeRoom("bulk-proj::dirty.ts", "dirty content", true);
    const clean = makeRoom("bulk-proj::clean.ts", "clean content", false);
    const internalDirty = makeRoom("bulk-proj::__presence__data", "presence", true);

    const rooms = new Map<string, Room>([
      [dirty.id, dirty],
      [clean.id, clean],
      [internalDirty.id, internalDirty],
    ]);

    mod.syncAllDirtyRoomsToDisk(rooms);

    const dirtyFile = join(workspacesDir, "bulk-proj", "dirty.ts");
    const cleanFile = join(workspacesDir, "bulk-proj", "clean.ts");
    const internalFile = join(workspacesDir, "bulk-proj", "__presence__data");

    expect(existsSync(dirtyFile)).toBe(true);
    expect(readFileSync(dirtyFile, "utf-8")).toBe("dirty content");
    expect(existsSync(cleanFile)).toBe(false);
    expect(existsSync(internalFile)).toBe(false);
  });
});

// ─── syncProjectToDisk ───────────────────────────────────────────────────────

describe("syncProjectToDisk", () => {
  it("returns 0 for a project with no files in the tree", () => {
    const count = mod.syncProjectToDisk("empty-sync-project");
    expect(count).toBe(0);
  });

  it("syncs a file when a Yjs snapshot is available", () => {
    const projectId = "snapshot-sync-proj";
    const filePath = "main.ts";
    const roomId = `${projectId}::${filePath}`;

    // Build a Yjs state snapshot with content
    const doc = new Y.Doc();
    doc.getText("content").insert(0, "const answer = 42;\n");
    const state = Y.encodeStateAsUpdate(doc);
    doc.destroy();

    // Save snapshot and create project tree
    snapshotMod.saveSnapshot(roomId, state);
    fileTreeMod.createNode(projectId, filePath, "file");

    const count = mod.syncProjectToDisk(projectId);
    expect(count).toBe(1);

    const expected = join(workspacesDir, projectId, filePath);
    expect(existsSync(expected)).toBe(true);
    expect(readFileSync(expected, "utf-8")).toBe("const answer = 42;\n");
  });

  it("skips files that have no snapshot and no active room", () => {
    const projectId = "no-snapshot-proj";
    fileTreeMod.createNode(projectId, "orphan.ts", "file");
    // No snapshot saved → getFileContent returns null → file is skipped
    const count = mod.syncProjectToDisk(projectId);
    expect(count).toBe(0);
  });
});
