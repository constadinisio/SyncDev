import { getCollabToken, getCachedCollabToken } from "./collab-token";

export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // Always use window.location — this function is only called client-side
  return `http://${window.location.hostname}:4000`;
}

/**
 * fetch wrapper that attaches the collab auth token (when enabled) as a
 * Bearer header. Falls back to a plain request in dev open mode.
 */
async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getCollabToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export interface FileNode {
  readonly name: string;
  readonly type: "file";
}

export interface FolderNode {
  readonly name: string;
  readonly type: "folder";
  readonly children: TreeNode[];
}

export type TreeNode = FileNode | FolderNode;

export interface ProjectTree {
  readonly projectId: string;
  readonly tree: TreeNode[];
}

export async function fetchProjectTree(projectId: string): Promise<ProjectTree> {
  const res = await authedFetch(`${getApiBase()}/api/files/${encodeURIComponent(projectId)}`);
  if (!res.ok) throw new Error(`Failed to fetch tree: ${res.status}`);
  return res.json();
}

export async function createProjectNode(
  projectId: string,
  path: string,
  type: "file" | "folder",
): Promise<ProjectTree> {
  const res = await authedFetch(`${getApiBase()}/api/files/${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, type }),
  });
  if (!res.ok) throw new Error(`Failed to create node: ${res.status}`);
  return res.json();
}

export async function deleteProjectNode(projectId: string, path: string): Promise<ProjectTree> {
  const res = await authedFetch(`${getApiBase()}/api/files/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Failed to delete node: ${res.status}`);
  return res.json();
}

export async function renameProjectNode(
  projectId: string,
  path: string,
  newName: string,
): Promise<ProjectTree> {
  const res = await authedFetch(`${getApiBase()}/api/files/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, newName }),
  });
  if (!res.ok) throw new Error(`Failed to rename node: ${res.status}`);
  return res.json();
}

export async function moveProjectNode(
  projectId: string,
  sourcePath: string,
  targetPath: string,
): Promise<ProjectTree> {
  const res = await authedFetch(`${getApiBase()}/api/files/${encodeURIComponent(projectId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourcePath, targetPath }),
  });
  if (!res.ok) throw new Error(`Failed to move node: ${res.status}`);
  return res.json();
}

export async function createProject(projectId: string): Promise<ProjectTree> {
  const res = await authedFetch(`${getApiBase()}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.status}`);
  return res.json();
}

export async function uploadFiles(
  projectId: string,
  files: readonly { readonly path: string; readonly content: string }[],
): Promise<ProjectTree> {
  const res = await authedFetch(`${getApiBase()}/api/upload/${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) throw new Error(`Failed to upload files: ${res.status}`);
  return res.json();
}

export async function executeTerminalCommand(
  projectId: string,
  command: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const res = await authedFetch(`${getApiBase()}/api/terminal/${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error(`Failed to execute command: ${res.status}`);
  return res.json();
}

export async function scanWorkspace(projectId: string): Promise<ProjectTree> {
  const res = await authedFetch(`${getApiBase()}/api/scan/${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to scan workspace: ${res.status}`);
  return res.json();
}

export async function cloneRepository(
  projectId: string,
  repoUrl: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await authedFetch(`${getApiBase()}/api/clone/${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl }),
  });
  return res.json();
}

export function getAssetUrl(projectId: string, filePath: string): string {
  const base = `${getApiBase()}/api/assets/${encodeURIComponent(projectId)}/${encodeURIComponent(filePath)}`;
  // <img>/<embed> can't send an Authorization header, so pass the token (when
  // present) as a query param — the collab service accepts ?token= too.
  const token = getCachedCollabToken();
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export function isImageExtension(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "bmp"].includes(ext);
}

export function isBinaryExtension(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "svg",
    "ico",
    "webp",
    "bmp",
    "pdf",
    "woff",
    "woff2",
    "ttf",
    "mp3",
    "wav",
    "mp4",
    "webm",
    "zip",
    "tar",
    "gz",
    "exe",
    "dll",
    "so",
    "dylib",
  ].includes(ext);
}

export async function fetchProjects(): Promise<string[]> {
  const res = await authedFetch(`${getApiBase()}/api/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  const data = await res.json();
  return data.projects;
}
