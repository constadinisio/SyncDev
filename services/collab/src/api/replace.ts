import type { ServerResponse } from "http";
import { getRooms } from "../rooms/room-manager.js";
import { loadSnapshot } from "../persistence/snapshot-store.js";
import { loadProjectTree } from "./file-tree.js";
import type { TreeNode } from "./file-tree.js";
import { getOrCreateRoom } from "../rooms/room-manager.js";
import * as Y from "yjs";
import { log } from "../lib/logger.js";

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

function getDocContent(projectId: string, filePath: string): string {
  const roomId = `${projectId}::${filePath}`;
  const rooms = getRooms();
  const existingRoom = rooms.get(roomId);
  if (existingRoom) {
    return existingRoom.doc.getText("content").toString();
  }
  const snapshot = loadSnapshot(roomId);
  if (!snapshot) return "";
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, snapshot);
    return doc.getText("content").toString();
  } finally {
    doc.destroy();
  }
}

export function handleReplaceRequest(
  res: ServerResponse,
  projectId: string,
  query: string,
  replacement: string,
  isRegex: boolean = false,
): void {
  if (!query) {
    writeJson(res, 400, { error: "query is required" });
    return;
  }

  const project = loadProjectTree(projectId);
  const filePaths = collectFilePaths(project.tree, "");
  let totalReplacements = 0;

  for (const filePath of filePaths) {
    const content = getDocContent(projectId, filePath);
    if (!content) continue;

    let newContent: string;
    let count = 0;

    if (isRegex) {
      try {
        const regex = new RegExp(query, "g");
        newContent = content.replace(regex, (...args) => {
          count++;
          // Support capture group references ($1, $2, etc.)
          let result = replacement;
          for (let i = 1; i < args.length - 2; i++) {
            result = result.replace(new RegExp(`\\$${i}`, "g"), args[i] ?? "");
          }
          return result;
        });
      } catch {
        writeJson(res, 400, { error: "Invalid regex pattern" });
        return;
      }
    } else {
      const lowerContent = content.toLowerCase();
      const lowerQuery = query.toLowerCase();
      // Case-insensitive replace
      const parts: string[] = [];
      let lastIdx = 0;
      let searchIdx = 0;

      while (searchIdx < lowerContent.length) {
        const matchIdx = lowerContent.indexOf(lowerQuery, searchIdx);
        if (matchIdx === -1) break;
        parts.push(content.substring(lastIdx, matchIdx));
        parts.push(replacement);
        lastIdx = matchIdx + query.length;
        searchIdx = matchIdx + 1;
        count++;
      }

      if (count === 0) continue;
      parts.push(content.substring(lastIdx));
      newContent = parts.join("");
    }

    if (count === 0) continue;

    // Apply the replacement to the Yjs document
    const roomId = `${projectId}::${filePath}`;
    const room = getOrCreateRoom(roomId);
    const ytext = room.doc.getText("content");
    room.doc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, newContent);
    });

    totalReplacements += count;
  }

  log("replace", `replaced ${totalReplacements} occurrence(s) in project "${projectId}"`);
  writeJson(res, 200, { replacements: totalReplacements });
}

function writeJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}
