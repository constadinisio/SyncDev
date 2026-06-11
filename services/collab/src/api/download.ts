import type { ServerResponse } from "http";
import archiver from "archiver";
import { loadProjectTree, type TreeNode, type FolderNode } from "./file-tree.js";
import { getOrCreateRoom } from "../rooms/room-manager.js";
import { logError } from "../lib/logger.js";
import { buildCorsHeaders } from "../lib/http.js";

function collectFilePaths(nodes: readonly TreeNode[], prefix: string): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "file") {
      paths.push(fullPath);
    } else {
      paths.push(...collectFilePaths((node as FolderNode).children, fullPath));
    }
  }
  return paths;
}

function getFileContent(projectId: string, filePath: string): string {
  const roomId = `${projectId}::${filePath}`;
  const room = getOrCreateRoom(roomId);
  return room.doc.getText("content").toString();
}

export function handleDownloadRequest(
  res: ServerResponse,
  projectId: string,
  origin?: string,
): void {
  try {
    const project = loadProjectTree(projectId);
    const filePaths = collectFilePaths(project.tree, "");

    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${projectId}.zip"`,
      ...buildCorsHeaders(origin),
    });

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err: Error) => {
      logError("download", `archive error for project "${projectId}"`, err);
      if (!res.writableEnded) {
        res.end();
      }
    });

    archive.pipe(res);

    for (const filePath of filePaths) {
      const content = getFileContent(projectId, filePath);
      archive.append(content, { name: filePath });
    }

    void archive.finalize();
  } catch (err) {
    logError("download", `failed to create zip for project "${projectId}"`, err);
    if (!res.headersSent) {
      res.writeHead(500, {
        "Content-Type": "application/json",
        ...buildCorsHeaders(origin),
      });
      res.end(JSON.stringify({ error: "Failed to create zip" }));
    }
  }
}
