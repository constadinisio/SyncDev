export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // Always use window.location — this function is only called client-side
  return `http://${window.location.hostname}:4000`;
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
  const res = await fetch(`${getApiBase()}/api/files/${encodeURIComponent(projectId)}`);
  if (!res.ok) throw new Error(`Failed to fetch tree: ${res.status}`);
  return res.json();
}

export async function createProjectNode(
  projectId: string,
  path: string,
  type: "file" | "folder",
): Promise<ProjectTree> {
  const res = await fetch(`${getApiBase()}/api/files/${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, type }),
  });
  if (!res.ok) throw new Error(`Failed to create node: ${res.status}`);
  return res.json();
}

export async function deleteProjectNode(
  projectId: string,
  path: string,
): Promise<ProjectTree> {
  const res = await fetch(`${getApiBase()}/api/files/${encodeURIComponent(projectId)}`, {
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
  const res = await fetch(`${getApiBase()}/api/files/${encodeURIComponent(projectId)}`, {
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
  const res = await fetch(`${getApiBase()}/api/files/${encodeURIComponent(projectId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourcePath, targetPath }),
  });
  if (!res.ok) throw new Error(`Failed to move node: ${res.status}`);
  return res.json();
}

export async function createProject(projectId: string): Promise<ProjectTree> {
  const res = await fetch(`${getApiBase()}/api/projects`, {
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
  const res = await fetch(`${getApiBase()}/api/upload/${encodeURIComponent(projectId)}`, {
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
  const res = await fetch(`${getApiBase()}/api/terminal/${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error(`Failed to execute command: ${res.status}`);
  return res.json();
}

export async function scanWorkspace(projectId: string): Promise<ProjectTree> {
  const res = await fetch(`${getApiBase()}/api/scan/${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to scan workspace: ${res.status}`);
  return res.json();
}

export async function fetchProjects(): Promise<string[]> {
  const res = await fetch(`${getApiBase()}/api/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  const data = await res.json();
  return data.projects;
}
