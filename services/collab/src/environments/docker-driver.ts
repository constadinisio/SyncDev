import { execFile } from "child_process";
import type { ContainerInspect, ExecResult, RunOptions } from "./types.js";
import { logError } from "../lib/logger.js";

/** Receives output lines as they are produced by a streaming docker command. */
export type LogSink = (line: string) => void;

/** Abstraction over the Docker CLI so the manager can be unit-tested with a fake. */
export interface DockerDriver {
  pull(image: string, onLog?: LogSink): Promise<void>;
  run(opts: RunOptions): Promise<void>;
  start(name: string): Promise<void>;
  exec(name: string, command: string, timeoutMs: number, onLog?: LogSink): Promise<ExecResult>;
  stop(name: string): Promise<void>;
  rm(name: string): Promise<void>;
  inspect(name: string): Promise<ContainerInspect>;
}

const MAX_OUTPUT = 100_000;
function truncate(s: string): string {
  return s.length <= MAX_OUTPUT ? s : s.slice(0, MAX_OUTPUT) + "\n... (truncated)";
}

/**
 * Splits a stream into complete lines, invoking `onLine` for each. Holds a
 * partial trailing line in `state` until more data (or a final flush) arrives.
 */
export function makeLineSplitter(onLine: (line: string) => void): {
  push: (chunk: string) => void;
  flush: () => void;
} {
  let buffer = "";
  return {
    push(chunk: string): void {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (line.length > 0) onLine(line);
      }
    },
    flush(): void {
      const line = buffer.replace(/\r$/, "");
      buffer = "";
      if (line.length > 0) onLine(line);
    },
  };
}

function docker(args: string[], timeoutMs: number, onLog?: LogSink): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "docker",
      args,
      { timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && (error as { code?: unknown }).code === undefined) {
          // Spawn-level failure (docker missing, timeout kill).
          reject(error);
          return;
        }
        resolve({
          stdout: truncate(stdout ?? ""),
          stderr: truncate(stderr ?? ""),
          exitCode:
            typeof (error as { code?: unknown } | null)?.code === "number"
              ? (error as { code: number }).code
              : 0,
        });
      },
    );
    if (onLog) {
      const splitter = makeLineSplitter(onLog);
      child.stdout?.on("data", (d: Buffer) => splitter.push(d.toString("utf-8")));
      child.stderr?.on("data", (d: Buffer) => splitter.push(d.toString("utf-8")));
      child.on("close", () => splitter.flush());
    }
    child.on("error", reject);
  });
}

export function createDockerDriver(): DockerDriver {
  return {
    async pull(image, onLog) {
      await docker(["pull", image], 300_000, onLog);
    },
    async run(opts) {
      const args = [
        "run",
        "-d",
        "--name",
        opts.name,
        "--network",
        opts.network,
        "--memory",
        opts.memory,
        "--memory-swap",
        opts.memory,
        "--cpus",
        opts.cpus,
        "--pids-limit",
        String(opts.pidsLimit),
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--user",
        opts.remoteUser,
        "-v",
        `${opts.workspaceHostPath}:${opts.workspaceFolder}`,
        "-w",
        opts.workspaceFolder,
      ];
      for (const [k, v] of Object.entries(opts.containerEnv)) {
        args.push("-e", `${k}=${v}`);
      }
      // Keep the container alive without a foreground process.
      args.push(opts.image, "sleep", "infinity");
      const res = await docker(args, 120_000);
      if (res.exitCode !== 0) throw new Error(`docker run failed: ${res.stderr}`);
    },
    async start(name) {
      const res = await docker(["start", name], 60_000);
      if (res.exitCode !== 0) throw new Error(`docker start failed: ${res.stderr}`);
    },
    exec(name, command, timeoutMs, onLog) {
      return docker(["exec", name, "sh", "-lc", command], timeoutMs, onLog);
    },
    async stop(name) {
      await docker(["stop", name], 30_000).catch((err) =>
        logError("docker", `stop ${name} failed`, err),
      );
    },
    async rm(name) {
      await docker(["rm", "-f", name], 30_000).catch((err) =>
        logError("docker", `rm ${name} failed`, err),
      );
    },
    async inspect(name) {
      const res = await docker(["inspect", "-f", "{{.State.Running}}", name], 10_000).catch(
        () => ({ stdout: "", stderr: "", exitCode: 1 }) as ExecResult,
      );
      if (res.exitCode !== 0) return { exists: false, running: false };
      return { exists: true, running: res.stdout.trim() === "true" };
    },
  };
}
