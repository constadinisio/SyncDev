import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let mod: typeof import("./file-tree.js");
let tmpDir: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "syncdev-filetree-"));
  process.env.NODE_ENV = "test";
  process.env.SNAPSHOT_DIR = join(tmpDir, "snapshots");
  process.env.PROJECTS_DIR = join(tmpDir, "projects");
  process.env.TERMINAL_WORKSPACE_DIR = join(tmpDir, "workspaces");

  mod = await import("./file-tree.js");
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── loadProjectTree ─────────────────────────────────────────────────────────

describe("loadProjectTree", () => {
  it("returns an empty tree for a project that does not exist yet", () => {
    const result = mod.loadProjectTree("brand-new-project");
    expect(result).toEqual({ projectId: "brand-new-project", tree: [] });
  });

  it("persists across calls (createNode, then load)", () => {
    mod.createNode("proj-persist", "file.ts", "file");
    const result = mod.loadProjectTree("proj-persist");
    expect(result.tree.some((n) => n.name === "file.ts")).toBe(true);
  });
});

// ─── createNode ──────────────────────────────────────────────────────────────

describe("createNode", () => {
  it("creates a file at the root level", () => {
    const result = mod.createNode("proj-file", "index.ts", "file");
    const node = result.tree.find((n) => n.name === "index.ts");
    expect(node?.type).toBe("file");
  });

  it("creates a folder at the root level with an empty children array", () => {
    const result = mod.createNode("proj-folder", "src", "folder");
    const node = result.tree.find((n) => n.name === "src");
    expect(node?.type).toBe("folder");
    if (node?.type === "folder") {
      expect(node.children).toEqual([]);
    }
  });

  it("is idempotent – duplicate creation does not add a second node", () => {
    mod.createNode("proj-idem", "index.ts", "file");
    const result = mod.createNode("proj-idem", "index.ts", "file");
    expect(result.tree.filter((n) => n.name === "index.ts")).toHaveLength(1);
  });

  it("creates a nested file inside an existing folder", () => {
    mod.createNode("proj-nested", "src", "folder");
    const result = mod.createNode("proj-nested", "src/index.ts", "file");
    const src = result.tree.find((n) => n.name === "src" && n.type === "folder");
    expect(src?.type).toBe("folder");
    if (src?.type === "folder") {
      expect(src.children.find((n) => n.name === "index.ts")?.type).toBe("file");
    }
  });

  it("returns unchanged tree when parent folder does not exist", () => {
    const result = mod.createNode("proj-noparent", "ghost/file.ts", "file");
    expect(result.tree).toHaveLength(0);
  });

  it("sorts folders before files, then alphabetically within each group", () => {
    mod.createNode("proj-sort", "z-file.ts", "file");
    mod.createNode("proj-sort", "a-file.ts", "file");
    mod.createNode("proj-sort", "m-folder", "folder");
    const result = mod.loadProjectTree("proj-sort");
    expect(result.tree[0].type).toBe("folder");
    expect(result.tree[0].name).toBe("m-folder");
    expect(result.tree[1].name).toBe("a-file.ts");
    expect(result.tree[2].name).toBe("z-file.ts");
  });

  it("does not mutate the previously loaded tree object", () => {
    const before = mod.loadProjectTree("proj-immutable");
    const snapshot = JSON.stringify(before);
    mod.createNode("proj-immutable", "added.ts", "file");
    // `before` reference must still look the same
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

// ─── deleteNode ──────────────────────────────────────────────────────────────

describe("deleteNode", () => {
  it("removes a root-level file", () => {
    mod.createNode("proj-del-file", "bye.ts", "file");
    const result = mod.deleteNode("proj-del-file", "bye.ts");
    expect(result.tree.find((n) => n.name === "bye.ts")).toBeUndefined();
  });

  it("removes a root-level folder and its contents from the tree", () => {
    mod.createNode("proj-del-folder", "mydir", "folder");
    mod.createNode("proj-del-folder", "mydir/inner.ts", "file");
    const result = mod.deleteNode("proj-del-folder", "mydir");
    expect(result.tree.find((n) => n.name === "mydir")).toBeUndefined();
  });

  it("is a no-op when the path does not exist", () => {
    mod.createNode("proj-del-noexist", "stays.ts", "file");
    const result = mod.deleteNode("proj-del-noexist", "ghost.ts");
    expect(result.tree.find((n) => n.name === "stays.ts")).toBeDefined();
  });

  it("removes a deeply nested file", () => {
    mod.createNode("proj-del-deep", "a", "folder");
    mod.createNode("proj-del-deep", "a/b", "folder");
    mod.createNode("proj-del-deep", "a/b/deep.ts", "file");
    const result = mod.deleteNode("proj-del-deep", "a/b/deep.ts");
    const a = result.tree.find((n) => n.name === "a");
    if (a?.type === "folder") {
      const b = a.children.find((n) => n.name === "b");
      if (b?.type === "folder") {
        expect(b.children.find((n) => n.name === "deep.ts")).toBeUndefined();
      }
    }
  });
});

// ─── renameNode ──────────────────────────────────────────────────────────────

describe("renameNode", () => {
  it("renames a root-level file", () => {
    mod.createNode("proj-rename", "old.ts", "file");
    const result = mod.renameNode("proj-rename", "old.ts", "new.ts");
    expect(result.tree.find((n) => n.name === "old.ts")).toBeUndefined();
    expect(result.tree.find((n) => n.name === "new.ts")?.type).toBe("file");
  });

  it("renames a root-level folder", () => {
    mod.createNode("proj-rename-folder", "old-dir", "folder");
    const result = mod.renameNode("proj-rename-folder", "old-dir", "new-dir");
    expect(result.tree.find((n) => n.name === "new-dir")?.type).toBe("folder");
  });

  it("is a no-op when the path does not exist", () => {
    const result = mod.renameNode("proj-rename-ghost", "ghost.ts", "other.ts");
    expect(result.tree).toHaveLength(0);
  });

  it("re-sorts after rename", () => {
    mod.createNode("proj-rename-sort", "z.ts", "file");
    mod.createNode("proj-rename-sort", "m.ts", "file");
    const result = mod.renameNode("proj-rename-sort", "z.ts", "a.ts");
    expect(result.tree[0].name).toBe("a.ts");
  });
});

// ─── moveNode ────────────────────────────────────────────────────────────────

describe("moveNode", () => {
  it("moves a file into a subfolder", () => {
    mod.createNode("proj-move", "dest", "folder");
    mod.createNode("proj-move", "file.ts", "file");
    const result = mod.moveNode("proj-move", "file.ts", "dest");
    expect(result.tree.find((n) => n.name === "file.ts" && n.type === "file")).toBeUndefined();
    const folder = result.tree.find((n) => n.name === "dest" && n.type === "folder");
    if (folder?.type === "folder") {
      expect(folder.children.find((n) => n.name === "file.ts")).toBeDefined();
    }
  });

  it("moves a file to the root when targetFolderPath is empty string", () => {
    mod.createNode("proj-move-root", "container", "folder");
    mod.createNode("proj-move-root", "container/buried.ts", "file");
    const result = mod.moveNode("proj-move-root", "container/buried.ts", "");
    expect(result.tree.find((n) => n.name === "buried.ts")).toBeDefined();
  });

  it("aborts when target folder does not exist (file stays in place)", () => {
    mod.createNode("proj-move-missing", "lonely.ts", "file");
    const result = mod.moveNode("proj-move-missing", "lonely.ts", "ghost-folder");
    expect(result.tree.find((n) => n.name === "lonely.ts")).toBeDefined();
  });

  it("aborts on name conflict in target (source stays in place)", () => {
    mod.createNode("proj-move-conflict", "dest", "folder");
    mod.createNode("proj-move-conflict", "dest/conflict.ts", "file");
    mod.createNode("proj-move-conflict", "conflict.ts", "file");
    const result = mod.moveNode("proj-move-conflict", "conflict.ts", "dest");
    expect(result.tree.find((n) => n.name === "conflict.ts")).toBeDefined();
  });
});

// ─── listProjects ────────────────────────────────────────────────────────────

describe("listProjects", () => {
  it("includes projects that have been created", () => {
    mod.createNode("list-proj-alpha", "file.ts", "file");
    mod.createNode("list-proj-beta", "file.ts", "file");
    const projects = mod.listProjects();
    expect(projects).toContain("list-proj-alpha");
    expect(projects).toContain("list-proj-beta");
  });

  it("returns an array", () => {
    expect(Array.isArray(mod.listProjects())).toBe(true);
  });
});
