import type { ServerResponse } from "http";
import { getRooms } from "../rooms/room-manager.js";
import { loadSnapshot } from "../persistence/snapshot-store.js";
import { loadProjectTree } from "./file-tree.js";
import type { TreeNode } from "./file-tree.js";
import * as Y from "yjs";
import { log } from "../lib/logger.js";

interface SearchMatch {
  readonly filePath: string;
  readonly line: number;
  readonly content: string;
  readonly matchStart: number;
  readonly matchEnd: number;
}

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

  // Check if room is already loaded in memory
  const rooms = getRooms();
  const existingRoom = rooms.get(roomId);
  if (existingRoom) {
    return existingRoom.doc.getText("content").toString();
  }

  // Otherwise, load from snapshot
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

function searchInContent(
  filePath: string,
  content: string,
  query: string,
  isRegex: boolean,
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lines = content.split("\n");

  if (isRegex) {
    let regex: RegExp;
    try {
      regex = new RegExp(query, "gi");
    } catch {
      return []; // Invalid regex, return no matches
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpExecArray | null;
      regex.lastIndex = 0;

      while ((match = regex.exec(line)) !== null) {
        matches.push({
          filePath,
          line: i + 1,
          content: line.substring(0, 200),
          matchStart: match.index,
          matchEnd: Math.min(match.index + match[0].length, 200),
        });

        if (match[0].length === 0) regex.lastIndex++;
        if (matches.length >= 100) return matches;
      }
    }
  } else {
    const lowerQuery = query.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      let searchStart = 0;

      while (searchStart < lowerLine.length) {
        const matchIdx = lowerLine.indexOf(lowerQuery, searchStart);
        if (matchIdx === -1) break;

        matches.push({
          filePath,
          line: i + 1,
          content: line.substring(0, 200),
          matchStart: matchIdx,
          matchEnd: Math.min(matchIdx + query.length, 200),
        });

        searchStart = matchIdx + 1;
        if (matches.length >= 100) return matches;
      }
    }
  }

  return matches;
}

export function handleSearchRequest(
  res: ServerResponse,
  projectId: string,
  query: string,
  isRegex: boolean = false,
): void {
  if (!query || query.length < 1) {
    writeJson(res, 200, { matches: [] });
    return;
  }

  const project = loadProjectTree(projectId);
  const filePaths = collectFilePaths(project.tree, "");

  const allMatches: SearchMatch[] = [];

  for (const filePath of filePaths) {
    const content = getDocContent(projectId, filePath);
    if (!content) continue;

    const fileMatches = searchInContent(filePath, content, query, isRegex);
    allMatches.push(...fileMatches);

    if (allMatches.length >= 500) break;
  }

  log(
    "search",
    `found ${allMatches.length} matches for "${query}" (regex: ${isRegex}) in project "${projectId}"`,
  );
  writeJson(res, 200, { matches: allMatches });
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
