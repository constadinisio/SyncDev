import type { IncomingMessage, ServerResponse } from "http";
import {
  loadProjectTree,
  createNode,
  deleteNode,
  renameNode,
  moveNode,
  listProjects,
} from "./file-tree.js";
import { handlePreviewRequest, handlePreviewEvents } from "./preview.js";
import { handleSearchRequest } from "./search.js";
import { handleTerminalRequest } from "./terminal.js";
import { handleHistoryRequest } from "./history.js";
import { handleDownloadRequest } from "./download.js";
import { handleUploadRequest } from "./upload.js";
import { handleScanRequest } from "./scan.js";
import { handleCloneRequest } from "./clone.js";
import { handleAssetRequest } from "./assets.js";
import { handleReplaceRequest } from "./replace.js";
import { handleSyncRequest } from "./sync.js";
import { logError } from "../lib/logger.js";
import { loadConfig } from "../lib/config.js";
import { buildCorsHeaders, writeJson } from "../lib/http.js";
import { isServerReady } from "../lib/readiness.js";
import { RateLimiter, getClientIp } from "../lib/rate-limit.js";
import { authenticate, AuthRequiredError, type AuthUser } from "../lib/auth.js";
import {
  ensureProjectAccess,
  filterAccessibleProjects,
  ForbiddenError,
} from "../lib/memberships.js";
import {
  ValidationError,
  parseJson,
  parseValue,
  projectIdSchema,
  createProjectSchema,
  createNodeSchema,
  deleteNodeSchema,
  moveNodeSchema,
  renameNodeSchema,
  terminalSchema,
  cloneSchema,
} from "../lib/validation.js";

const config = loadConfig();

// Rate limiter for resource-heavy / abusable endpoints.
const sensitiveLimiter = new RateLimiter({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
});
const SENSITIVE_ROUTE = /^\/api\/(terminal|clone|upload|scan)\//;

// Periodically reclaim memory from expired rate-limit buckets.
setInterval(() => sensitiveLimiter.sweep(Date.now()), 60_000).unref();

function writeCors(res: ServerResponse, origin: string | undefined): void {
  res.writeHead(204, buildCorsHeaders(origin));
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
  const origin = req.headers.origin;

  // Local helpers that carry the request's Origin into the CORS headers, so
  // every existing json()/cors() call site stays unchanged.
  const json = (res2: ServerResponse, status: number, data: unknown): void =>
    writeJson(res2, status, data, origin);
  const cors = (res2: ServerResponse): void => writeCors(res2, origin);

  // Maps validation failures to 400, forbidden to 403, everything else to 500.
  const fail = (err: unknown, message: string): void => {
    if (err instanceof ValidationError) {
      json(res, 400, { error: err.message });
      return;
    }
    if (err instanceof ForbiddenError) {
      json(res, 403, { error: err.message });
      return;
    }
    logError("api", message, err);
    json(res, 500, { error: "internal error" });
  };

  if (method === "OPTIONS") {
    cors(res);
    return true;
  }

  // Throttle resource-heavy endpoints per client IP.
  if (SENSITIVE_ROUTE.test(url)) {
    const { allowed, resetAt } = sensitiveLimiter.hit(getClientIp(req), Date.now());
    if (!allowed) {
      const retryAfter = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
      json(res, 429, { error: "rate limit exceeded", retryAfter });
      return true;
    }
  }

  // GET /health — liveness probe (process is up)
  if (url === "/health" && method === "GET") {
    json(res, 200, { status: "ok" });
    return true;
  }

  // GET /ready — readiness probe (dependencies initialized)
  if (url === "/ready" && method === "GET") {
    const ready = isServerReady();
    json(res, ready ? 200 : 503, {
      status: ready ? "ready" : "starting",
    });
    return true;
  }

  // Authenticate the request. In enforced mode a missing/invalid token is 401;
  // otherwise (dev open mode) `user` is null and access proceeds.
  let user: AuthUser | null;
  try {
    user = await authenticate(req);
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      json(res, 401, { error: "unauthorized" });
      return true;
    }
    throw err;
  }

  // Per-project authorization. Returns false (and responds 403) when the
  // authenticated user may not access the project; claims ownership on first
  // access. No-op in dev open mode.
  const authorize = (pid: string): boolean => {
    try {
      ensureProjectAccess(pid, user);
      return true;
    } catch (err) {
      if (err instanceof ForbiddenError) {
        json(res, 403, { error: "forbidden" });
        return false;
      }
      throw err;
    }
  };

  // GET /api/projects — list all projects (filtered to the user's projects)
  if (url === "/api/projects" && method === "GET") {
    const projects = filterAccessibleProjects(listProjects(), user);
    json(res, 200, { projects });
    return true;
  }

  // POST /api/projects — create a project
  if (url === "/api/projects" && method === "POST") {
    try {
      const { projectId } = parseJson(createProjectSchema, await readBody(req));
      if (!authorize(projectId)) return true;
      const tree = loadProjectTree(projectId);
      json(res, 201, tree);
    } catch (err) {
      fail(err, "failed to create project");
    }
    return true;
  }

  // GET /preview-events/:projectId — SSE for live reload
  const sseMatch = url.match(/^\/preview-events\/([^/?]+)/);
  if (sseMatch && method === "GET") {
    const pid = decodeURIComponent(sseMatch[1]);
    if (!authorize(pid)) return true;
    handlePreviewEvents(req, res, pid, origin);
    return true;
  }

  // GET /preview/:projectId/path/to/file — serve file content from Y.Doc
  const previewMatch = url.match(/^\/preview\/([^/]+)\/(.+)/);
  if (previewMatch && method === "GET") {
    const pid = decodeURIComponent(previewMatch[1]);
    if (!authorize(pid)) return true;
    const filePath = decodeURIComponent(previewMatch[2]);
    handlePreviewRequest(req, res, pid, filePath, origin);
    return true;
  }

  // GET /api/search/:projectId?q=searchterm — search all files in project
  const searchMatch = url.match(/^\/api\/search\/([^/?]+)/);
  if (searchMatch && method === "GET") {
    const pid = decodeURIComponent(searchMatch[1]);
    if (!authorize(pid)) return true;
    const urlObj = new URL(url, "http://localhost");
    const query = urlObj.searchParams.get("q") ?? "";
    const isRegex = urlObj.searchParams.get("regex") === "1";
    handleSearchRequest(res, pid, query, isRegex, origin);
    return true;
  }

  // POST /api/terminal/:projectId — execute a command
  const terminalMatch = url.match(/^\/api\/terminal\/([^/?]+)/);
  if (terminalMatch && method === "POST") {
    try {
      const pid = parseValue(projectIdSchema, decodeURIComponent(terminalMatch[1]));
      if (!authorize(pid)) return true;
      const { command } = parseJson(terminalSchema, await readBody(req));
      await handleTerminalRequest(res, pid, command, origin);
    } catch (err) {
      fail(err, "failed to execute terminal command");
    }
    return true;
  }

  // GET /api/history/:projectId/:filePath — get edit history for a file
  const historyMatch = url.match(/^\/api\/history\/([^/]+)\/(.+)/);
  if (historyMatch && method === "GET") {
    const pid = decodeURIComponent(historyMatch[1]);
    if (!authorize(pid)) return true;
    const filePath = decodeURIComponent(historyMatch[2]);
    handleHistoryRequest(res, pid, filePath, origin);
    return true;
  }

  // GET /api/download/:projectId — download project as ZIP
  const downloadMatch = url.match(/^\/api\/download\/([^/?]+)/);
  if (downloadMatch && method === "GET") {
    const pid = decodeURIComponent(downloadMatch[1]);
    if (!authorize(pid)) return true;
    handleDownloadRequest(res, pid, origin);
    return true;
  }

  // POST /api/scan/:projectId — scan workspace and load files into tree
  const scanMatch = url.match(/^\/api\/scan\/([^/?]+)/);
  if (scanMatch && method === "POST") {
    const pid = decodeURIComponent(scanMatch[1]);
    if (!authorize(pid)) return true;
    try {
      handleScanRequest(res, pid, origin);
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
    if (!authorize(pid)) return true;
    try {
      const body = await readBody(req);
      handleUploadRequest(res, pid, body, origin);
    } catch (err) {
      logError("api", "failed to handle upload", err);
      json(res, 500, { error: "internal error" });
    }
    return true;
  }

  // POST /api/sync/:projectId — sync all Yjs files to disk (for git)
  const syncMatch = url.match(/^\/api\/sync\/([^/?]+)/);
  if (syncMatch && method === "POST") {
    const pid = decodeURIComponent(syncMatch[1]);
    if (!authorize(pid)) return true;
    handleSyncRequest(res, pid, origin);
    return true;
  }

  // POST /api/replace/:projectId — find and replace across files
  const replaceMatch = url.match(/^\/api\/replace\/([^/?]+)/);
  if (replaceMatch && method === "POST") {
    const pid = decodeURIComponent(replaceMatch[1]);
    if (!authorize(pid)) return true;
    const urlObj = new URL(url, "http://localhost");
    const query = urlObj.searchParams.get("q") ?? "";
    const replacement = urlObj.searchParams.get("replace") ?? "";
    const isRegex = urlObj.searchParams.get("regex") === "1";
    handleReplaceRequest(res, pid, query, replacement, isRegex, origin);
    return true;
  }

  // POST /api/clone/:projectId — clone a git repository
  const cloneMatch = url.match(/^\/api\/clone\/([^/?]+)/);
  if (cloneMatch && method === "POST") {
    try {
      const pid = parseValue(projectIdSchema, decodeURIComponent(cloneMatch[1]));
      if (!authorize(pid)) return true;
      const { repoUrl } = parseJson(cloneSchema, await readBody(req));
      await handleCloneRequest(res, pid, repoUrl, origin);
    } catch (err) {
      fail(err, "failed to clone repository");
    }
    return true;
  }

  // GET /api/assets/:projectId/:filePath — serve binary/image files from workspace
  const assetMatch = url.match(/^\/api\/assets\/([^/]+)\/(.+)/);
  if (assetMatch && method === "GET") {
    const pid = decodeURIComponent(assetMatch[1]);
    if (!authorize(pid)) return true;
    const filePath = decodeURIComponent(assetMatch[2]);
    handleAssetRequest(res, pid, filePath, origin);
    return true;
  }

  // Match /api/files/<projectId>
  const filesMatch = url.match(/^\/api\/files\/([^/?]+)/);
  if (!filesMatch) return false;

  let projectId: string;
  try {
    projectId = parseValue(projectIdSchema, decodeURIComponent(filesMatch[1]));
  } catch (err) {
    fail(err, "invalid projectId");
    return true;
  }
  if (!authorize(projectId)) return true;

  // GET /api/files/:projectId — get file tree
  if (method === "GET") {
    const tree = loadProjectTree(projectId);
    json(res, 200, tree);
    return true;
  }

  // POST /api/files/:projectId — create file or folder
  if (method === "POST") {
    try {
      const { path, type } = parseJson(createNodeSchema, await readBody(req));
      const updated = createNode(projectId, path, type);
      json(res, 201, updated);
    } catch (err) {
      fail(err, "failed to create node");
    }
    return true;
  }

  // DELETE /api/files/:projectId — delete file or folder
  if (method === "DELETE") {
    try {
      const { path } = parseJson(deleteNodeSchema, await readBody(req));
      const updated = deleteNode(projectId, path);
      json(res, 200, updated);
    } catch (err) {
      fail(err, "failed to delete node");
    }
    return true;
  }

  // PUT /api/files/:projectId — move file or folder
  if (method === "PUT") {
    try {
      const { sourcePath, targetPath } = parseJson(moveNodeSchema, await readBody(req));
      const updated = moveNode(projectId, sourcePath, targetPath);
      json(res, 200, updated);
    } catch (err) {
      fail(err, "failed to move node");
    }
    return true;
  }

  // PATCH /api/files/:projectId — rename file or folder
  if (method === "PATCH") {
    try {
      const { path, newName } = parseJson(renameNodeSchema, await readBody(req));
      const updated = renameNode(projectId, path, newName);
      json(res, 200, updated);
    } catch (err) {
      fail(err, "failed to rename node");
    }
    return true;
  }

  return false;
}
