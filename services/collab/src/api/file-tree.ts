import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  rmSync,
} from "fs";
import { join } from "path";
import { log, logError } from "../lib/logger.js";
import { deleteSnapshot } from "../persistence/snapshot-store.js";
import { getRooms } from "../rooms/room-manager.js";
import { destroyRoom } from "../rooms/room.js";

const WORKSPACE_BASE =
  process.env.TERMINAL_WORKSPACE_DIR ?? "./storage/workspaces";

const PROJECTS_DIR = process.env.PROJECTS_DIR ?? "./storage/projects";

// --- Types ---

export interface FileNode {
  readonly name: string;
  readonly type: "file";
}

export interface FolderNode {
  readonly name: string;
  readonly type: "folder";
  readonly children: TreeNode[];
  expanded?: boolean;
}

export type TreeNode = FileNode | FolderNode;

export interface ProjectTree {
  readonly projectId: string;
  readonly tree: TreeNode[];
}

// --- Persistence ---

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function projectPath(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(PROJECTS_DIR, `${safeId}.json`);
}

export function loadProjectTree(projectId: string): ProjectTree {
  const filePath = projectPath(projectId);
  if (!existsSync(filePath)) {
    return { projectId, tree: [] };
  }
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ProjectTree;
  } catch (err) {
    logError("file-tree", `failed to load project "${projectId}"`, err);
    return { projectId, tree: [] };
  }
}

function saveProjectTree(project: ProjectTree): void {
  ensureDir(PROJECTS_DIR);
  const filePath = projectPath(project.projectId);
  const tmpPath = `${filePath}.tmp`;
  const data = JSON.stringify(project, null, 2);
  writeFileSync(tmpPath, data, "utf-8");
  renameSync(tmpPath, filePath);
  log("file-tree", `saved project tree "${project.projectId}"`);
}

// --- Tree operations ---

function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function findParent(
  tree: TreeNode[],
  segments: string[],
): { parent: TreeNode[] | null; name: string } {
  if (segments.length === 0) return { parent: null, name: "" };
  if (segments.length === 1) return { parent: tree, name: segments[0] };

  let current = tree;
  for (let i = 0; i < segments.length - 1; i++) {
    const folder = current.find(
      (n) => n.name === segments[i] && n.type === "folder",
    ) as FolderNode | undefined;
    if (!folder) return { parent: null, name: segments[segments.length - 1] };
    current = folder.children;
  }
  return { parent: current, name: segments[segments.length - 1] };
}

export function createNode(
  projectId: string,
  path: string,
  type: "file" | "folder",
): ProjectTree {
  const project = loadProjectTree(projectId);
  const tree = structuredClone(project.tree) as TreeNode[];
  const segments = splitPath(path);
  const { parent, name } = findParent(tree, segments);

  if (!parent || !name) return { projectId, tree };

  // Check if already exists
  if (parent.some((n) => n.name === name)) return { projectId, tree };

  if (type === "folder") {
    parent.push({ name, type: "folder", children: [] });
  } else {
    parent.push({ name, type: "file" });
  }

  // Sort: folders first, then alphabetically
  parent.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const updated = { projectId, tree };
  saveProjectTree(updated);
  return updated;
}

function collectAllPaths(nodes: readonly TreeNode[], prefix: string): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    const p = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "file") {
      paths.push(p);
    } else {
      paths.push(...collectAllPaths(node.children, p));
    }
  }
  return paths;
}

export function deleteNode(projectId: string, path: string): ProjectTree {
  const project = loadProjectTree(projectId);
  const tree = structuredClone(project.tree) as TreeNode[];
  const segments = splitPath(path);
  const { parent, name } = findParent(tree, segments);

  if (!parent || !name) return { projectId, tree };

  const idx = parent.findIndex((n) => n.name === name);
  if (idx === -1) return { projectId, tree };

  const deletedNode = parent[idx];
  parent.splice(idx, 1);

  // Collect all file paths that were deleted (for cleanup)
  const deletedPaths = deletedNode.type === "file"
    ? [path]
    : collectAllPaths([deletedNode], path.substring(0, path.lastIndexOf("/") + 0) ? path.substring(0, path.length - name.length) : "").map(
        (p) => {
          const base = path.substring(0, path.length - name.length);
          return base ? `${base}${p}` : p;
        },
      );

  // Actually, simpler: if it's a folder, collect paths from it
  const pathsToClean = deletedNode.type === "file"
    ? [path]
    : collectAllPaths([deletedNode], path);

  // Clean up Yjs rooms and snapshots for deleted files
  const rooms = getRooms();
  for (const filePath of pathsToClean) {
    const roomId = `${projectId}::${filePath}`;
    // Delete snapshot
    deleteSnapshot(roomId);
    // Destroy active room if any
    const room = rooms.get(roomId);
    if (room) {
      destroyRoom(room);
      (rooms as Map<string, unknown>).delete(roomId);
      log("file-tree", `destroyed room "${roomId}" after file deletion`);
    }
  }

  // Delete from disk
  const safeProjectId = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const diskPath = join(WORKSPACE_BASE, safeProjectId, path);
  if (existsSync(diskPath)) {
    try {
      if (deletedNode.type === "folder") {
        rmSync(diskPath, { recursive: true, force: true });
      } else {
        unlinkSync(diskPath);
      }
      log("file-tree", `deleted from disk: "${diskPath}"`);
    } catch (err) {
      logError("file-tree", `failed to delete from disk: "${diskPath}"`, err);
    }
  }

  const updated = { projectId, tree };
  saveProjectTree(updated);
  return updated;
}

export function renameNode(
  projectId: string,
  oldPath: string,
  newName: string,
): ProjectTree {
  const project = loadProjectTree(projectId);
  const tree = structuredClone(project.tree) as TreeNode[];
  const segments = splitPath(oldPath);
  const { parent, name } = findParent(tree, segments);

  if (!parent || !name) return { projectId, tree };

  const node = parent.find((n) => n.name === name);
  if (!node) return { projectId, tree };

  // Mutate the cloned node's name
  (node as { name: string }).name = newName;

  parent.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const updated = { projectId, tree };
  saveProjectTree(updated);
  return updated;
}

export function moveNode(
  projectId: string,
  sourcePath: string,
  targetFolderPath: string,
): ProjectTree {
  const project = loadProjectTree(projectId);
  const tree = structuredClone(project.tree) as TreeNode[];

  // Find and remove the source node
  const sourceSegments = splitPath(sourcePath);
  const { parent: sourceParent, name: sourceName } = findParent(tree, sourceSegments);
  if (!sourceParent || !sourceName) return { projectId, tree };

  const sourceIdx = sourceParent.findIndex((n) => n.name === sourceName);
  if (sourceIdx === -1) return { projectId, tree };

  const [sourceNode] = sourceParent.splice(sourceIdx, 1);

  // Find the target folder
  let targetChildren: TreeNode[];
  if (!targetFolderPath) {
    targetChildren = tree;
  } else {
    const targetSegments = splitPath(targetFolderPath);
    let current = tree;
    for (const seg of targetSegments) {
      const folder = current.find(
        (n) => n.name === seg && n.type === "folder",
      ) as FolderNode | undefined;
      if (!folder) {
        // Target folder not found, abort (re-add source)
        sourceParent.splice(sourceIdx, 0, sourceNode);
        return { projectId, tree };
      }
      current = folder.children;
    }
    targetChildren = current;
  }

  // Check if name already exists in target
  if (targetChildren.some((n) => n.name === sourceNode.name)) {
    // Name conflict, abort (re-add source)
    sourceParent.splice(sourceIdx, 0, sourceNode);
    return { projectId, tree };
  }

  targetChildren.push(sourceNode);
  targetChildren.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const updated = { projectId, tree };
  saveProjectTree(updated);
  return updated;
}

export function listProjects(): string[] {
  ensureDir(PROJECTS_DIR);
  try {
    const files = readdirSync(PROJECTS_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}
