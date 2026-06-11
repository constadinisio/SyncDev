/** Lifecycle status of a project environment. */
export type EnvironmentStatus = "stopped" | "building" | "running" | "error";

/** A devcontainer config resolved to the fields SyncDev honors. */
export interface ResolvedDevcontainerConfig {
  readonly image: string;
  readonly postCreateCommand: string | null;
  readonly forwardPorts: readonly number[];
  readonly containerEnv: Readonly<Record<string, string>>;
  readonly remoteUser: string;
  readonly workspaceFolder: string;
}

export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** Mutable in-memory state for one project's environment. */
export interface EnvironmentState {
  readonly projectId: string;
  readonly containerName: string;
  status: EnvironmentStatus;
  /** True when the container is up but postCreateCommand failed. */
  setupFailed: boolean;
  config: ResolvedDevcontainerConfig | null;
  /** Epoch ms of the last exec or status change; drives idle eviction order. */
  lastActivity: number;
}

/** Options for starting a container, passed to the DockerDriver. */
export interface RunOptions {
  readonly name: string;
  readonly image: string;
  /** Absolute host path bind-mounted as the workspace. */
  readonly workspaceHostPath: string;
  readonly workspaceFolder: string;
  readonly remoteUser: string;
  readonly containerEnv: Readonly<Record<string, string>>;
  readonly memory: string;
  readonly cpus: string;
  readonly pidsLimit: number;
  readonly network: string;
}

export interface ContainerInspect {
  readonly exists: boolean;
  readonly running: boolean;
}
