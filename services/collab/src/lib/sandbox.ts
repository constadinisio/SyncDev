import { execFile } from "child_process";
import { resolve } from "path";
import { loadConfig } from "./config.js";
import { log, logError } from "./logger.js";

/**
 * Runs untrusted terminal commands inside an ephemeral, locked-down Docker
 * container instead of directly on the host.
 *
 * Hardening applied to every run:
 *  - `--rm` ephemeral container, unique name so it can be force-killed.
 *  - `--cap-drop ALL` + `--security-opt no-new-privileges` (no privilege gain).
 *  - non-root user, `--read-only` root fs with a writable tmpfs at /tmp.
 *  - memory / cpu / pids limits to bound resource abuse.
 *  - only the project's workspace is mounted (rw), at /workspace.
 *  - the user command is passed as a single argument to `sh -lc`, so it is
 *    confined to the container — host shell injection is impossible.
 */

const config = loadConfig();

export interface SandboxResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

const MAX_OUTPUT_LENGTH = 100_000;

function truncate(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output;
  return output.substring(0, MAX_OUTPUT_LENGTH) + "\n... (output truncated)";
}

function buildDockerArgs(containerName: string, workspaceAbs: string, command: string): string[] {
  const { image, memory, cpus, pidsLimit, network } = config.terminal;
  return [
    "run",
    "--rm",
    "--name",
    containerName,
    "--network",
    network,
    "--memory",
    memory,
    "--memory-swap",
    memory, // disallow swap beyond the memory limit
    "--cpus",
    cpus,
    "--pids-limit",
    String(pidsLimit),
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,exec,size=256m",
    "--user",
    "1000:1000",
    "-v",
    `${workspaceAbs}:/workspace`,
    "-w",
    "/workspace",
    "-e",
    "HOME=/tmp",
    "-e",
    "TERM=dumb",
    "-e",
    "FORCE_COLOR=0",
    image,
    "sh",
    "-lc",
    command,
  ];
}

/** Generates a unique, docker-safe container name without Math.random. */
let runCounter = 0;
function nextContainerName(projectId: string): string {
  runCounter += 1;
  const safe = projectId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40);
  return `syncdev_${safe}_${process.pid}_${runCounter}`;
}

/**
 * Runs `command` inside a sandboxed container, bind-mounting `mountSource`
 * (a host path) as /workspace. `projectId` is used only to name the container.
 */
export function runInDocker(
  mountSource: string,
  command: string,
  timeoutMs: number,
  projectId: string,
): Promise<SandboxResult> {
  const containerName = nextContainerName(projectId);
  const workspaceAbs = resolve(mountSource);
  const args = buildDockerArgs(containerName, workspaceAbs, command);

  return new Promise((resolvePromise) => {
    const child = execFile(
      "docker",
      args,
      { timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          // On timeout, execFile kills the docker client but the container may
          // linger — force-remove it.
          if ((error as { killed?: boolean }).killed) {
            execFile("docker", ["rm", "-f", containerName], () => {});
          }
          resolvePromise({
            stdout: truncate(stdout ?? ""),
            stderr: truncate(stderr || error.message || "Command failed"),
            exitCode:
              typeof (error as { code?: unknown }).code === "number"
                ? ((error as { code: number }).code)
                : 1,
          });
          return;
        }
        resolvePromise({
          stdout: truncate(stdout ?? ""),
          stderr: truncate(stderr ?? ""),
          exitCode: 0,
        });
      },
    );

    child.on("error", (err) => {
      logError("sandbox", "failed to spawn docker", err);
      resolvePromise({
        stdout: "",
        stderr: "Sandbox unavailable: could not start Docker. Is the daemon running?",
        exitCode: 1,
      });
    });
  });
}

/** Verifies the Docker daemon is reachable; logs a warning if not. */
export function checkDockerAvailable(): void {
  execFile("docker", ["version", "--format", "{{.Server.Version}}"], (error, stdout) => {
    if (error) {
      logError("sandbox", "Docker daemon not reachable — terminal sandbox will fail", error);
    } else {
      log("sandbox", `Docker available (server ${stdout.trim()})`);
    }
  });
}
