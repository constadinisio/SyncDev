import type { IncomingMessage, ServerResponse } from "http";
import {
  loadProjectTree,
  createNode,
  deleteNode,
  renameNode,
  moveNode,
  listProjects,
} from "./file-tree.js";
import {
  handlePreviewRequest,
  handlePreviewEvents,
} from "./preview.js";
import { handleSearchRequest } from "./search.js";
import { handleTerminalRequest } from "./terminal.js";
import { handleHistoryRequest } from "./history.js";
import { handleDownloadRequest } from "./download.js";
import { handleUploadRequest } from "./upload.js";
import { handleScanRequest } from "./scan.js";
import { logError } from "../lib/logger.js";

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function cors(res: ServerResponse): void {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    cors(res);
    return true;
  }

  // GET /api/projects — list all projects
  if (url === "/api/projects" && method === "GET") {
    const projects = listProjects();
    json(res, 200, { projects });
    return true;
  }

  // POST /api/projects — create a project
  if (url === "/api/projects" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const projectId = body.projectId as string;
      if (!projectId) {
        json(res, 400, { error: "projectId is required" });
        return true;
      }
      const tree = loadProjectTree(projectId);
      json(res, 201, tree);
    } catch (err) {
      logError("api", "failed to create project", err);
      json(res, 500, { error: "internal error" });
    }
    return true;
  }

  // GET /preview-events/:projectId — SSE for live reload
  const sseMatch = url.match(/^\/preview-events\/([^/?]+)/);
  if (sseMatch && method === "GET") {
    const pid = decodeURIComponent(sseMatch[1]);
    handlePreviewEvents(req, res, pid);
    return true;
  }

  // GET /preview/:projectId/path/to/file — serve file content from Y.Doc
  const previewMatch = url.match(/^\/preview\/([^/]+)\/(.+)/);
  if (previewMatch && method === "GET") {
    const pid = decodeURIComponent(previewMatch[1]);
    const filePath = decodeURIComponent(previewMatch[2]);
    handlePreviewRequest(req, res, pid, filePath);
    return true;
  }

  // GET /api/search/:projectId?q=searchterm — search all files in project
  const searchMatch = url.match(/^\/api\/search\/([^/?]+)/);
  if (searchMatch && method === "GET") {
    const pid = decodeURIComponent(searchMatch[1]);
    const urlObj = new URL(url, "http://localhost");
    const query = urlObj.searchParams.get("q") ?? "";
    handleSearchRequest(res, pid, query);
    return true;
  }

  // POST /api/terminal/:projectId — execute a command
  const terminalMatch = url.match(/^\/api\/terminal\/([^/?]+)/);
  if (terminalMatch && method === "POST") {
    const pid = decodeURIComponent(terminalMatch[1]);
    try {
      const body = JSON.parse(await readBody(req));
      const { command } = body as { command: string };
      await handleTerminalRequest(res, pid, command);
    } catch (err) {
      logError("api", "failed to execute terminal command", err);
      json(res, 500, { error: "internal error" });
    }
    return true;
  }

  // GET /api/history/:projectId/:filePath — get edit history for a file
  const historyMatch = url.match(/^\/api\/history\/([^/]+)\/(.+)/);
  if (historyMatch && method === "GET") {
    const pid = decodeURIComponent(historyMatch[1]);
    const filePath = decodeURIComponent(historyMatch[2]);
    handleHistoryRequest(res, pid, filePath);
    return true;
  }

  // GET /api/download/:projectId — download project as ZIP
  const downloadMatch = url.match(/^\/api\/download\/([^/?]+)/);
  if (downloadMatch && method === "GET") {
    const pid = decodeURIComponent(downloadMatch[1]);
    handleDownloadRequest(res, pid);
    return true;
  }

  // POST /api/scan/:projectId — scan workspace and load files into tree
  const scanMatch = url.match(/^\/api\/scan\/([^/?]+)/);
  if (scanMatch && method === "POST") {
    const pid = decodeURIComponent(scanMatch[1]);
    try {
      handleScanRequest(res, pid);
    } catch (err) {
      logError("api", "failed to scan workspace", err);
      json(res, 500, { error: "internal error" });
    }
    return true;
  }

  // POST /api/upload/:projectId — upload files
  const uploadMatch = url.match(/^\/api\/upload\/([^/?]+)/);
  if (uploadMatch && method === "POST") {
    const pid = decodeURIComponent(uploadMatch[1]);
    try {
      const body = await readBody(req);
      handleUploadRequest(res, pid, body);
    } catch (err) {
      logError("api", "failed to handle upload", err);
      json(res, 500, { error: "internal error" });
    }
    return true;
  }

  // Match /api/files/<projectId>
  const filesMatch = url.match(/^\/api\/files\/([^/?]+)/);
  if (!filesMatch) return false;

  const projectId = decodeURIComponent(filesMatch[1]);

  // GET /api/files/:projectId — get file tree
  if (method === "GET") {
    const tree = loadProjectTree(projectId);
    json(res, 200, tree);
    return true;
  }

  // POST /api/files/:projectId — create file or folder
  if (method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const { path, type } = body as { path: string; type: "file" | "folder" };
      if (!path || !type) {
        json(res, 400, { error: "path and type are required" });
        return true;
      }
      const updated = createNode(projectId, path, type);
      json(res, 201, updated);
    } catch (err) {
      logError("api", "failed to create node", err);
      json(res, 500, { error: "internal error" });
    }
    return true;
  }

  // DELETE /api/files/:projectId — delete file or folder
  if (method === "DELETE") {
    try {
      const body = JSON.parse(await readBody(req));
      const { path } = body as { path: string };
      if (!path) {
        json(res, 400, { error: "path is required" });
        return true;
      }
      const updated = deleteNode(projectId, path);
      json(res, 200, updated);
    } catch (err) {
      logError("api", "failed to delete node", err);
      json(res, 500, { error: "internal error" });
    }
    return true;
  }

  // PUT /api/files/:projectId — move file or folder
  if (method === "PUT") {
    try {
      const body = JSON.parse(await readBody(req));
      const { sourcePath, targetPath } = body as {
        sourcePath: string;
        targetPath: string;
      };
      if (!sourcePath || targetPath === undefined) {
        json(res, 400, { error: "sourcePath and targetPath are required" });
        return true;
      }
      const updated = moveNode(projectId, sourcePath, targetPath);
      json(res, 200, updated);
    } catch (err) {
      logError("api", "failed to move node", err);
      json(res, 500, { error: "internal error" });
    }
    return true;
  }

  // PATCH /api/files/:projectId — rename file or folder
  if (method === "PATCH") {
    try {
      const body = JSON.parse(await readBody(req));
      const { path, newName } = body as { path: string; newName: string };
      if (!path || !newName) {
        json(res, 400, { error: "path and newName are required" });
        return true;
      }
      const updated = renameNode(projectId, path, newName);
      json(res, 200, updated);
    } catch (err) {
      logError("api", "failed to rename node", err);
      json(res, 500, { error: "internal error" });
    }
    return true;
  }

  return false;
}
