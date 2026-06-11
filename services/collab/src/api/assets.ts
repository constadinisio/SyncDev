import type { ServerResponse } from "http";
import { existsSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";

const WORKSPACE_BASE =
  process.env.TERMINAL_WORKSPACE_DIR ?? "./storage/workspaces";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp",
]);

const BINARY_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ".pdf", ".woff", ".woff2", ".ttf", ".mp3", ".wav", ".mp4", ".webm",
  ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".dylib",
]);

export function isBinaryFile(fileName: string): boolean {
  const ext = extname(fileName).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

export function isImageFile(fileName: string): boolean {
  const ext = extname(fileName).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

export function handleAssetRequest(
  res: ServerResponse,
  projectId: string,
  filePath: string,
): void {
  const safeProjectId = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fullPath = join(WORKSPACE_BASE, safeProjectId, filePath);

  // Prevent directory traversal
  const resolved = join(WORKSPACE_BASE, safeProjectId);
  if (!fullPath.startsWith(resolved)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  if (!existsSync(fullPath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  const stat = statSync(fullPath);

  const data = readFileSync(fullPath);

  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": stat.size,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  });
  res.end(data);
}

export interface AssetInfo {
  readonly fileName: string;
  readonly size: number;
  readonly mime: string;
  readonly isImage: boolean;
}

export function getAssetInfo(
  projectId: string,
  filePath: string,
): AssetInfo | null {
  const safeProjectId = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fullPath = join(WORKSPACE_BASE, safeProjectId, filePath);

  if (!existsSync(fullPath)) return null;

  const ext = extname(filePath).toLowerCase();
  const stat = statSync(fullPath);
  const fileName = filePath.split("/").pop() ?? filePath;

  return {
    fileName,
    size: stat.size,
    mime: MIME_TYPES[ext] ?? "application/octet-stream",
    isImage: IMAGE_EXTENSIONS.has(ext),
  };
}
