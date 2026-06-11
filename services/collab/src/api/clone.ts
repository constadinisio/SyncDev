import type { ServerResponse } from "http";
import { exec } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { log, logError } from "../lib/logger.js";
import { writeJson } from "../lib/http.js";

const WORKSPACE_BASE = process.env.TERMINAL_WORKSPACE_DIR ?? "./storage/workspaces";

function getWorkspaceDir(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(WORKSPACE_BASE, safeId);
}

function getShell(): string {
  if (process.platform !== "win32") return "/bin/bash";
  const gitBashPaths = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ];
  for (const p of gitBashPaths) {
    if (existsSync(p)) return p;
  }
  return "powershell.exe";
}

export async function handleCloneRequest(
  res: ServerResponse,
  projectId: string,
  repoUrl: string,
  origin?: string,
): Promise<void> {
  if (!repoUrl || typeof repoUrl !== "string") {
    writeJson(res, 400, { error: "repoUrl is required" }, origin);
    return;
  }

  // Basic URL validation
  const urlPattern = /^(https?:\/\/|git@).+\..+/;
  if (!urlPattern.test(repoUrl.trim())) {
    writeJson(res, 400, { error: "Invalid repository URL" }, origin);
    return;
  }

  const workspaceDir = getWorkspaceDir(projectId);

  if (existsSync(join(workspaceDir, ".git"))) {
    writeJson(res, 409, { error: "Project already has a git repository" }, origin);
    return;
  }

  // Ensure workspace directory exists
  if (!existsSync(workspaceDir)) {
    mkdirSync(workspaceDir, { recursive: true });
  }

  log("clone", `cloning "${repoUrl}" into project "${projectId}"`);

  try {
    await new Promise<void>((resolve, reject) => {
      // Clone into a temp dir, then move contents to workspace
      // This handles the case where workspace dir already exists
      const command = `git clone "${repoUrl.trim()}" . 2>&1`;

      exec(
        command,
        {
          cwd: workspaceDir,
          timeout: 300_000, // 5 minutes
          maxBuffer: 10 * 1024 * 1024,
          shell: getShell(),
          env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        },
        (error, stdout, stderr) => {
          if (error) {
            const msg = stderr || stdout || error.message;
            logError("clone", `clone failed for "${projectId}"`, error);
            reject(new Error(msg));
            return;
          }
          resolve();
        },
      );
    });

    log("clone", `clone successful for project "${projectId}"`);
    writeJson(res, 200, { success: true, message: "Repository cloned successfully" }, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clone failed";
    writeJson(res, 500, { error: message }, origin);
  }
}
