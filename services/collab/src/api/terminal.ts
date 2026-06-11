import type { ServerResponse } from "http";
import { exec } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { log, logError } from "../lib/logger.js";
import { loadConfig } from "../lib/config.js";
import { runInDocker } from "../lib/sandbox.js";
import { writeJson } from "../lib/http.js";

const config = loadConfig();
const WORKSPACE_BASE = process.env.TERMINAL_WORKSPACE_DIR ?? "./storage/workspaces";
const MAX_COMMAND_LENGTH = 4000;
const MAX_OUTPUT_LENGTH = 100_000;

function getShell(): string {
  if (process.platform !== "win32") return "/bin/bash";

  // On Windows, prefer Git Bash for proper git/unix command support
  const gitBashPaths = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ];

  for (const p of gitBashPaths) {
    if (existsSync(p)) return p;
  }

  // Fallback to PowerShell which handles git better than cmd.exe
  return "powershell.exe";
}

// Timeout tiers: long-running commands get more time
const LONG_RUNNING_PREFIXES = [
  "npm install",
  "npm i ",
  "npm ci",
  "npx create-",
  "npx -y create-",
  "yarn install",
  "yarn add",
  "pnpm install",
  "pnpm add",
  "pip install",
  "cargo build",
  "cargo install",
  "go build",
  "go install",
  "go mod",
  "dotnet restore",
  "dotnet build",
  "docker build",
  "docker pull",
  "git clone",
  "npm run build",
  "npm run dev",
  "npx next build",
];

function getTimeoutMs(command: string): number {
  const lower = command.toLowerCase().trim();
  if (LONG_RUNNING_PREFIXES.some((p) => lower.startsWith(p))) {
    return 300_000; // 5 minutes for install/build commands
  }
  return 30_000; // 30 seconds for normal commands
}

// Commands that are never allowed
const BLOCKED_PATTERNS = [
  "rm -rf /",
  "rm -rf /*",
  "mkfs",
  "dd if=",
  ":(){",
  "fork bomb",
  "shutdown",
  "reboot",
  "halt",
  "poweroff",
  "format c:",
];

function getWorkspaceDir(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = join(WORKSPACE_BASE, safeId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function isCommandBlocked(command: string): boolean {
  const lower = command.toLowerCase().trim();
  return BLOCKED_PATTERNS.some((blocked) => lower.includes(blocked));
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output;
  return output.substring(0, MAX_OUTPUT_LENGTH) + "\n... (output truncated)";
}

interface TerminalResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

function executeCommand(command: string, cwd: string, timeoutMs: number): Promise<TerminalResult> {
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 5 * 1024 * 1024, // 5MB buffer for large outputs
        shell: getShell(),
        env: {
          ...process.env,
          // Keep the system PATH so npm, node, git, python etc. are found
          // Override HOME to workspace for npm config isolation
          npm_config_prefix: cwd,
          TERM: "dumb",
          FORCE_COLOR: "0",
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            stdout: truncateOutput(stdout ?? ""),
            stderr: truncateOutput(stderr ?? error.message ?? "Command failed"),
            exitCode:
              error.code !== undefined ? (typeof error.code === "number" ? error.code : 1) : 1,
          });
          return;
        }

        resolve({
          stdout: truncateOutput(stdout ?? ""),
          stderr: truncateOutput(stderr ?? ""),
          exitCode: 0,
        });
      },
    );
  });
}

export async function handleTerminalRequest(
  res: ServerResponse,
  projectId: string,
  command: string,
  origin?: string,
): Promise<void> {
  if (!command || typeof command !== "string") {
    writeJson(res, 400, { error: "command is required" }, origin);
    return;
  }

  if (command.length > MAX_COMMAND_LENGTH) {
    writeJson(
      res,
      400,
      { error: `Command exceeds maximum length of ${MAX_COMMAND_LENGTH} characters` },
      origin,
    );
    return;
  }

  // The host-side blocklist is a fragile defense only relevant when commands
  // run directly on the host (dev). In Docker mode, container isolation is the
  // real boundary, so the blocklist is skipped.
  if (!config.terminal.useDocker && isCommandBlocked(command)) {
    writeJson(res, 403, { error: "This command is not allowed" }, origin);
    return;
  }

  const cwd = getWorkspaceDir(projectId);
  const timeoutMs = getTimeoutMs(command);
  const mode = config.terminal.useDocker ? "docker" : "host";
  log(
    "terminal",
    `[${projectId}] (${mode}) $ ${command.substring(0, 200)} (timeout: ${timeoutMs / 1000}s)`,
  );

  try {
    let result;
    if (config.terminal.useDocker) {
      // When this service runs in a container, the bind-mount source must be a
      // host path. Translate <WORKSPACE_BASE>/<id> to <hostBase>/<id>.
      const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
      const mountSource = config.terminal.hostWorkspaceBase
        ? join(config.terminal.hostWorkspaceBase, safeId)
        : cwd;
      result = await runInDocker(mountSource, command, timeoutMs, projectId);
    } else {
      result = await executeCommand(command, cwd, timeoutMs);
    }
    writeJson(res, 200, result, origin);
  } catch (err) {
    logError("terminal", "unexpected error executing command", err);
    writeJson(res, 500, { stdout: "", stderr: "Internal server error", exitCode: 1 }, origin);
  }
}
