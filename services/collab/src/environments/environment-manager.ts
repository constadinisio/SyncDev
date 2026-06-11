import type { DockerDriver } from "./docker-driver.js";
import type { EnvironmentState, ExecResult, ResolvedDevcontainerConfig } from "./types.js";
import { log, logError } from "../lib/logger.js";

const POST_CREATE_TIMEOUT_MS = 300_000;

export interface EnvironmentLimits {
  readonly memory: string;
  readonly cpus: string;
  readonly pidsLimit: number;
  readonly network: string;
  readonly maxActive: number;
}

export interface EnvironmentManagerDeps {
  readonly driver: DockerDriver;
  readonly loadConfig: (projectId: string) => ResolvedDevcontainerConfig;
  readonly hostWorkspacePath: (projectId: string) => string;
  readonly limits: EnvironmentLimits;
  /** Injected clock for deterministic tests. Defaults to Date.now. */
  readonly now?: () => number;
  /** Optional sink for status/log events (used by the SSE hub). */
  readonly onEvent?: (projectId: string, event: EnvironmentEvent) => void;
}

export interface EnvironmentEvent {
  readonly type: "status" | "log";
  readonly status?: EnvironmentState["status"];
  readonly setupFailed?: boolean;
  readonly line?: string;
}

function containerName(projectId: string): string {
  return `syncdev-env-${projectId.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

export class EnvironmentManager {
  private readonly states = new Map<string, EnvironmentState>();
  private readonly inflight = new Map<string, Promise<EnvironmentState>>();
  private readonly now: () => number;

  constructor(private readonly deps: EnvironmentManagerDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  status(projectId: string): EnvironmentState {
    return this.states.get(projectId) ?? this.stoppedState(projectId);
  }

  private stoppedState(projectId: string): EnvironmentState {
    return {
      projectId,
      containerName: containerName(projectId),
      status: "stopped",
      setupFailed: false,
      config: null,
      lastActivity: this.now(),
    };
  }

  private setStatus(state: EnvironmentState, status: EnvironmentState["status"]): void {
    state.status = status;
    state.lastActivity = this.now();
    this.deps.onEvent?.(state.projectId, {
      type: "status",
      status,
      setupFailed: state.setupFailed,
    });
  }

  ensureRunning(projectId: string): Promise<EnvironmentState> {
    const existing = this.states.get(projectId);
    if (existing && existing.status === "running") {
      existing.lastActivity = this.now();
      return Promise.resolve(existing);
    }
    const pending = this.inflight.get(projectId);
    if (pending) return pending;

    const promise = this.start(projectId).finally(() => this.inflight.delete(projectId));
    this.inflight.set(projectId, promise);
    return promise;
  }

  private async start(projectId: string): Promise<EnvironmentState> {
    const state = this.states.get(projectId) ?? this.stoppedState(projectId);
    this.states.set(projectId, state);

    try {
      const config = this.deps.loadConfig(projectId);
      state.config = config;
      this.setStatus(state, "building");
      this.enforceMaxActive(projectId);

      const inspect = await this.deps.driver.inspect(state.containerName);
      if (inspect.exists) {
        if (!inspect.running) await this.deps.driver.start(state.containerName);
        this.setStatus(state, "running");
        return state;
      }

      await this.deps.driver.pull(config.image);
      await this.deps.driver.run({
        name: state.containerName,
        image: config.image,
        workspaceHostPath: this.deps.hostWorkspacePath(projectId),
        workspaceFolder: config.workspaceFolder,
        remoteUser: config.remoteUser,
        containerEnv: config.containerEnv,
        memory: this.deps.limits.memory,
        cpus: this.deps.limits.cpus,
        pidsLimit: this.deps.limits.pidsLimit,
        network: this.deps.limits.network,
      });

      if (config.postCreateCommand) {
        const res: ExecResult = await this.deps.driver.exec(
          state.containerName,
          config.postCreateCommand,
          POST_CREATE_TIMEOUT_MS,
        );
        state.setupFailed = res.exitCode !== 0;
        if (state.setupFailed) {
          this.deps.onEvent?.(projectId, { type: "log", line: res.stderr || res.stdout });
          logError("env", `postCreateCommand failed for "${projectId}" (exit ${res.exitCode})`);
        }
      }

      this.setStatus(state, "running");
      log("env", `environment "${projectId}" running (setupFailed=${state.setupFailed})`);
      return state;
    } catch (err) {
      state.setupFailed = false;
      this.setStatus(state, "error");
      logError("env", `failed to start environment "${projectId}"`, err);
      return state;
    }
  }

  private enforceMaxActive(exclude: string): void {
    const running = [...this.states.values()].filter(
      (s) => s.projectId !== exclude && (s.status === "running" || s.status === "building"),
    );
    if (running.length < this.deps.limits.maxActive) return;
    // Evict the least-recently-active environment.
    const victim = running.sort((a, b) => a.lastActivity - b.lastActivity)[0];
    if (victim) {
      void this.stop(victim.projectId, true).catch((err) =>
        logError("env", `eviction of "${victim.projectId}" failed`, err),
      );
    }
  }

  async stop(projectId: string, remove = false): Promise<void> {
    const state = this.states.get(projectId);
    if (!state) return;
    if (remove) {
      await this.deps.driver.rm(state.containerName);
      this.states.delete(projectId);
    } else {
      await this.deps.driver.stop(state.containerName);
      this.setStatus(state, "stopped");
    }
  }

  async exec(projectId: string, command: string, timeoutMs: number): Promise<ExecResult> {
    const state = await this.ensureRunning(projectId);
    if (state.status !== "running") {
      return { stdout: "", stderr: "Environment failed to start", exitCode: 1 };
    }
    state.lastActivity = this.now();
    return this.deps.driver.exec(state.containerName, command, timeoutMs);
  }

  async rebuild(projectId: string): Promise<EnvironmentState> {
    await this.stop(projectId, true);
    return this.ensureRunning(projectId);
  }
}
