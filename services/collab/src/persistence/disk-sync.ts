import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { log, logError } from "../lib/logger.js";
import { loadSnapshot } from "./snapshot-store.js";
import { getRooms } from "../rooms/room-manager.js";
import { loadProjectTree } from "../api/file-tree.js";
import type { TreeNode } from "../api/file-tree.js";
import * as Y from "yjs";
import type { Room } from "../types/index.js";

const WORKSPACE_BASE =
  process.env.TERMINAL_WORKSPACE_DIR ?? "./storage/workspaces";

// Room IDs that are internal and should not be synced to disk
const INTERNAL_ROOM_PREFIXES = ["__chat__", "__presence__", "__history__"];

function isFileRoom(roomId: string): boolean {
  const parts = roomId.split("::");
  if (parts.length !== 2) return false;
  const filePath = parts[1];
  return !INTERNAL_ROOM_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function parseRoomId(roomId: string): { projectId: string; filePath: string } | null {
  const separatorIdx = roomId.indexOf("::");
  if (separatorIdx === -1) return null;
  const projectId = roomId.substring(0, separatorIdx);
  const filePath = roomId.substring(separatorIdx + 2);
  if (!projectId || !filePath) return null;
  return { projectId, filePath };
}

function getWorkspaceDir(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(WORKSPACE_BASE, safeId);
}

/**
 * Writes the Y.Text content of a room to the corresponding file on disk.
 */
export function syncRoomToDisk(room: Room): void {
  if (!isFileRoom(room.id)) return;

  const parsed = parseRoomId(room.id);
  if (!parsed) return;

  const { projectId, filePath } = parsed;
  const workspaceDir = getWorkspaceDir(projectId);

  if (!existsSync(workspaceDir)) {
    mkdirSync(workspaceDir, { recursive: true });
  }

  const fullPath = join(workspaceDir, filePath);
  const dir = dirname(fullPath);

  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const content = room.doc.getText("content").toString();
    writeFileSync(fullPath, content, "utf-8");
  } catch (err) {
    logError("disk-sync", `failed to sync "${filePath}" to disk for project "${projectId}"`, err);
  }
}

/**
 * Syncs all dirty rooms to disk. Called during periodic save.
 */
export function syncAllDirtyRoomsToDisk(rooms: ReadonlyMap<string, Room>): void {
  let synced = 0;
  for (const room of rooms.values()) {
    if (room.dirty && isFileRoom(room.id)) {
      syncRoomToDisk(room);
      synced++;
    }
  }
  if (synced > 0) {
    log("disk-sync", `synced ${synced} file(s) to disk`);
  }
}

/**
 * Gets file content from an active room or from a snapshot on disk.
 */
function getFileContent(projectId: string, filePath: string): string | null {
  const roomId = `${projectId}::${filePath}`;

  // Check active rooms first
  const rooms = getRooms();
  const room = rooms.get(roomId);
  if (room) {
    return room.doc.getText("content").toString();
  }

  // Load from snapshot
  const snapshot = loadSnapshot(roomId);
  if (!snapshot) return null;

  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, snapshot);
    return doc.getText("content").toString();
  } finally {
    doc.destroy();
  }
}

/**
 * Collects all file paths from a project tree.
 */
function collectFilePaths(nodes: readonly TreeNode[], prefix: string): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "file") {
      paths.push(path);
    } else if (node.type === "folder") {
      paths.push(...collectFilePaths(node.children, path));
    }
  }
  return paths;
}

/**
 * Syncs ALL files of a project to disk.
 * Loads from active rooms or snapshots.
 * Called before git operations to ensure the filesystem is up to date.
 */
export function syncProjectToDisk(projectId: string): number {
  const project = loadProjectTree(projectId);
  const filePaths = collectFilePaths(project.tree, "");
  const workspaceDir = getWorkspaceDir(projectId);

  if (!existsSync(workspaceDir)) {
    mkdirSync(workspaceDir, { recursive: true });
  }

  let synced = 0;

  for (const filePath of filePaths) {
    const content = getFileContent(projectId, filePath);
    if (content === null) continue;

    const fullPath = join(workspaceDir, filePath);
    const dir = dirname(fullPath);

    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(fullPath, content, "utf-8");
      synced++;
    } catch (err) {
      logError("disk-sync", `failed to sync "${filePath}" for project "${projectId}"`, err);
    }
  }

  log("disk-sync", `full project sync: ${synced}/${filePaths.length} files written for "${projectId}"`);
  return synced;
}
