import type { ServerResponse } from "http";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { loadProjectTree, createNode, type TreeNode } from "./file-tree.js";
import { getOrCreateRoom } from "../rooms/room-manager.js";
import { log, logError } from "../lib/logger.js";
import { writeJson } from "../lib/http.js";

const WORKSPACE_BASE = process.env.TERMINAL_WORKSPACE_DIR ?? "./storage/workspaces";

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "__pycache__",
  ".git",
  "dist",
  "build",
  ".cache",
  ".turbo",
]);

const MAX_FILE_SIZE = 1_048_576; // 1MB

function getWorkspaceDir(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(WORKSPACE_BASE, safeId);
}

function isTextContent(buffer: Buffer): boolean {
  // Check for null bytes (common in binary files)
  for (let i = 0; i < Math.min(buffer.length, 8192); i++) {
    if (buffer[i] === 0) return false;
  }
  return true;
}

interface ScannedFile {
  readonly path: string;
  readonly content: string;
}

function scanDirectory(baseDir: string, relativePath: string): readonly ScannedFile[] {
  const fullPath = relativePath ? join(baseDir, relativePath) : baseDir;

  if (!existsSync(fullPath)) return [];

  const results: ScannedFile[] = [];

  try {
    const entries = readdirSync(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const nested = scanDirectory(baseDir, entryRelative);
        results.push(...nested);
      } else if (entry.isFile()) {
        const entryFull = join(baseDir, entryRelative);
        try {
          const stat = statSync(entryFull);
          if (stat.size > MAX_FILE_SIZE) continue;
          if (stat.size === 0) {
            results.push({ path: entryRelative, content: "" });
            continue;
          }

          const buffer = readFileSync(entryFull);
          if (!isTextContent(buffer)) continue;

          results.push({
            path: entryRelative,
            content: buffer.toString("utf-8"),
          });
        } catch {
          // Skip unreadable files
        }
      }
    }
  } catch {
    // Skip unreadable directories
  }

  return results;
}

function setFileContent(projectId: string, filePath: string, content: string): void {
  const roomId = `${projectId}::${filePath}`;
  const room = getOrCreateRoom(roomId);
  const ytext = room.doc.getText("content");
  room.doc.transact(() => {
    ytext.delete(0, ytext.length);
    ytext.insert(0, content);
  });
}

function ensureFoldersExist(projectId: string, filePath: string): void {
  const segments = filePath.split("/").filter(Boolean);
  for (let i = 1; i < segments.length; i++) {
    const folderPath = segments.slice(0, i).join("/");
    createNode(projectId, folderPath, "folder");
  }
}

export function handleScanRequest(res: ServerResponse, projectId: string, origin?: string): void {
  try {
    const workspaceDir = getWorkspaceDir(projectId);

    if (!existsSync(workspaceDir)) {
      writeJson(res, 200, loadProjectTree(projectId), origin);
      return;
    }

    log("scan", `scanning workspace for project "${projectId}"`);

    const files = scanDirectory(workspaceDir, "");
    log("scan", `found ${files.length} files in "${projectId}"`);

    for (const file of files) {
      ensureFoldersExist(projectId, file.path);
      createNode(projectId, file.path, "file");
      setFileContent(projectId, file.path, file.content);
    }

    const updatedTree = loadProjectTree(projectId);
    log("scan", `scan complete for "${projectId}": ${files.length} files loaded`);

    writeJson(res, 200, updatedTree, origin);
  } catch (err) {
    logError("scan", `failed to scan workspace for "${projectId}"`, err);
    if (!res.headersSent) {
      writeJson(res, 500, { error: "Failed to scan workspace" }, origin);
    }
  }
}
