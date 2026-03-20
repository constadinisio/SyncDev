import type { ServerResponse } from "http";
import { loadProjectTree, createNode, type TreeNode, type FolderNode } from "./file-tree.js";
import { getOrCreateRoom } from "../rooms/room-manager.js";
import { log, logError } from "../lib/logger.js";

interface UploadFile {
  readonly path: string;
  readonly content: string;
}

interface UploadPayload {
  readonly files: readonly UploadFile[];
}

function ensureFoldersExist(projectId: string, filePath: string): void {
  const segments = filePath.split("/").filter(Boolean);
  // Create all parent folders if they don't exist
  for (let i = 1; i < segments.length; i++) {
    const folderPath = segments.slice(0, i).join("/");
    createNode(projectId, folderPath, "folder");
  }
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

export function handleUploadRequest(
  res: ServerResponse,
  projectId: string,
  body: string,
): void {
  try {
    const payload: UploadPayload = JSON.parse(body);

    if (!payload.files || !Array.isArray(payload.files)) {
      res.writeHead(400, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ error: "files array is required" }));
      return;
    }

    for (const file of payload.files) {
      if (!file.path || typeof file.content !== "string") {
        continue;
      }

      // Ensure parent folders exist
      ensureFoldersExist(projectId, file.path);

      // Create the file node in the tree
      createNode(projectId, file.path, "file");

      // Set the file content in the Yjs room
      setFileContent(projectId, file.path, file.content);

      log("upload", `uploaded file "${file.path}" to project "${projectId}"`);
    }

    // Return the updated tree
    const updatedTree = loadProjectTree(projectId);

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end(JSON.stringify(updatedTree));
  } catch (err) {
    logError("upload", `failed to upload files for project "${projectId}"`, err);
    if (!res.headersSent) {
      res.writeHead(500, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ error: "Failed to upload files" }));
    }
  }
}
