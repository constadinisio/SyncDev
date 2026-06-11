# Reproducible Environments (devcontainers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each SyncDev project a persistent, declaratively-defined Docker dev environment (via `.devcontainer/devcontainer.json`) that terminal commands run inside, with lazy start and idle stop.

**Architecture:** A new `environments/` subsystem in the collab service owns one persistent container per project. A `DockerDriver` interface (real impl shells out to `docker`; fake impl backs unit tests) isolates Docker so the `EnvironmentManager` state machine is fully unit-testable. A `presence` module aggregates per-project client counts from the room manager; `lifecycle` uses it to stop idle environments. The terminal routes commands to the manager when `ENVIRONMENTS_ENABLED`; new `/api/env/*` REST + SSE endpoints expose status/control to a web panel.

**Tech Stack:** Node 20, TypeScript (ESM, NodeNext `.js` specifiers), zod, Vitest, Docker CLI, Next.js 14 (web).

**Spec:** `docs/superpowers/specs/2026-06-11-reproducible-environments-design.md`

---

## File Structure

**Collab — new files (`services/collab/src/environments/`):**
- `types.ts` — shared types (status, resolved config, state, exec result, run options).
- `devcontainer-config.ts` — parse/validate `.devcontainer/devcontainer.json`, field whitelist, default fallback.
- `docker-driver.ts` — `DockerDriver` interface + real CLI implementation + `createDockerDriver()`.
- `environment-manager.ts` — the state machine (`ensureRunning`/`exec`/`stop`/`rebuild`/`status`, MAX cap).
- `presence.ts` — per-project client-count tracking + empty/active listeners.
- `lifecycle.ts` — wires presence → idle stop; `initEnvironmentLifecycle()`.
- `events.ts` — per-project SSE hub for status + log lines.
- Tests: `devcontainer-config.test.ts`, `environment-manager.test.ts`, `presence.test.ts`, `lifecycle.test.ts`.

**Collab — new API file:**
- `services/collab/src/api/environments.ts` — REST handlers (`status`/`start`/`rebuild`/`stop`) + SSE events.

**Collab — modified files:**
- `lib/config.ts` — add `environments` config block.
- `api/terminal.ts` — route to manager when enabled.
- `api/routes.ts` — wire `/api/env/*` routes.
- `rooms/room-manager.ts` — notify `presence` on join/leave.
- `server.ts` — `initEnvironmentLifecycle()`.
- `.env.example` — document new vars.
- `vitest.config.ts` — add new modules to coverage `include`.

**Web — new files:**
- `apps/web/src/lib/env-api.ts` — client API + SSE subscribe.
- `apps/web/src/components/environment/EnvironmentPanel.tsx` — status panel + actions.

**Web — modified files:**
- `apps/web/src/app/editor/[roomId]/EditorPageClient.tsx` — mount the panel.

---

## Phase 1 — Config and shared types

### Task 1: Environment config block

**Files:**
- Modify: `services/collab/src/lib/config.ts`
- Test: `services/collab/src/lib/config.test.ts`

- [ ] **Step 1: Write the failing test** — append inside the existing `describe("loadConfig")` block in `config.test.ts`:

```typescript
  it("exposes environment defaults", () => {
    const cfg = loadConfig({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(cfg.environments.enabled).toBe(false);
    expect(cfg.environments.defaultImage).toContain("devcontainers");
    expect(cfg.environments.maxActive).toBe(5);
    expect(cfg.environments.idleMs).toBe(600000);
  });

  it("enables environments by default in production", () => {
    const cfg = loadConfig(PROD_BASE);
    expect(cfg.environments.enabled).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w services/collab run test -- config.test`
Expected: FAIL — `cfg.environments` is undefined.

- [ ] **Step 3: Add the config type and resolution.** In `config.ts`, add to the `AppConfig` interface (after `sentryDsn`):

```typescript
  /** Reproducible per-project dev environments (devcontainers). */
  readonly environments: EnvironmentConfig;
```

Add the interface near `TerminalSandboxConfig`:

```typescript
export interface EnvironmentConfig {
  /** When true, terminal commands run in the persistent per-project container. */
  readonly enabled: boolean;
  /** Image used when a project has no .devcontainer/devcontainer.json. */
  readonly defaultImage: string;
  /** Max concurrent running environments (single-VPS protection). */
  readonly maxActive: number;
  /** Idle delay (ms) before stopping an environment with no connected clients. */
  readonly idleMs: number;
}
```

Inside `loadConfig`, in the frozen object (after `sentryDsn`):

```typescript
    environments: Object.freeze({
      enabled: parseBoolean("ENVIRONMENTS_ENABLED", env.ENVIRONMENTS_ENABLED, isProduction),
      defaultImage:
        env.DEVCONTAINER_DEFAULT_IMAGE ??
        "mcr.microsoft.com/devcontainers/javascript-node:20",
      maxActive: parseInteger("MAX_ACTIVE_ENVIRONMENTS", env.MAX_ACTIVE_ENVIRONMENTS, 5),
      idleMs: parseInteger("ENV_IDLE_MS", env.ENV_IDLE_MS, 600_000),
    }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w services/collab run test -- config.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/collab/src/lib/config.ts services/collab/src/lib/config.test.ts
git commit -m "feat(collab): add environment config block"
```

### Task 2: Shared environment types

**Files:**
- Create: `services/collab/src/environments/types.ts`

- [ ] **Step 1: Create the types file** (no test — pure type declarations, exercised by later tasks):

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npm -w services/collab run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add services/collab/src/environments/types.ts
git commit -m "feat(collab): environment shared types"
```

---

## Phase 2 — devcontainer config parsing (TDD)

### Task 3: Parse, validate, default and whitelist the devcontainer

**Files:**
- Create: `services/collab/src/environments/devcontainer-config.ts`
- Test: `services/collab/src/environments/devcontainer-config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { parseDevcontainer, defaultDevcontainer } from "./devcontainer-config.js";

const DEFAULT_IMAGE = "mcr.microsoft.com/devcontainers/javascript-node:20";

describe("defaultDevcontainer", () => {
  it("uses the provided default image and sensible defaults", () => {
    const cfg = defaultDevcontainer(DEFAULT_IMAGE);
    expect(cfg.image).toBe(DEFAULT_IMAGE);
    expect(cfg.postCreateCommand).toBeNull();
    expect(cfg.remoteUser).toBe("node");
    expect(cfg.workspaceFolder).toBe("/workspace");
  });
});

describe("parseDevcontainer", () => {
  it("parses a minimal valid config", () => {
    const cfg = parseDevcontainer(
      JSON.stringify({ image: "node:20", postCreateCommand: "npm install" }),
      DEFAULT_IMAGE,
    );
    expect(cfg.image).toBe("node:20");
    expect(cfg.postCreateCommand).toBe("npm install");
  });

  it("normalizes an array postCreateCommand into a single string", () => {
    const cfg = parseDevcontainer(
      JSON.stringify({ image: "node:20", postCreateCommand: ["npm", "ci"] }),
      DEFAULT_IMAGE,
    );
    expect(cfg.postCreateCommand).toBe("npm ci");
  });

  it("strips forbidden/unknown fields (privileged, runArgs, mounts)", () => {
    const cfg = parseDevcontainer(
      JSON.stringify({
        image: "node:20",
        privileged: true,
        runArgs: ["--network=host"],
        mounts: ["/etc:/etc"],
      }),
      DEFAULT_IMAGE,
    );
    expect(cfg).not.toHaveProperty("privileged");
    expect(cfg).not.toHaveProperty("runArgs");
    expect(cfg).not.toHaveProperty("mounts");
    expect(cfg.image).toBe("node:20");
  });

  it("throws on malformed JSON", () => {
    expect(() => parseDevcontainer("{not json", DEFAULT_IMAGE)).toThrow(/JSON/);
  });

  it("throws when image is missing", () => {
    expect(() => parseDevcontainer(JSON.stringify({ remoteUser: "x" }), DEFAULT_IMAGE)).toThrow(
      /image/,
    );
  });

  it("rejects a non-numeric forwardPorts entry", () => {
    expect(() =>
      parseDevcontainer(JSON.stringify({ image: "node:20", forwardPorts: ["x"] }), DEFAULT_IMAGE),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w services/collab run test -- devcontainer-config.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
import { z } from "zod";
import type { ResolvedDevcontainerConfig } from "./types.js";

/**
 * The ONLY devcontainer.json fields SyncDev honors. Anything else (privileged,
 * runArgs, mounts, features, dockerComposeFile, ...) is ignored so a project
 * cannot request host escalation through its committed config.
 */
const devcontainerSchema = z
  .object({
    image: z.string().min(1, "image is required").max(512),
    postCreateCommand: z.union([z.string().max(4000), z.array(z.string()).max(64)]).optional(),
    forwardPorts: z.array(z.number().int().min(1).max(65535)).max(32).optional(),
    containerEnv: z.record(z.string(), z.string()).optional(),
    remoteUser: z.string().max(64).optional(),
    workspaceFolder: z.string().max(512).optional(),
  })
  // Drop unknown keys instead of failing, so unsupported features are simply ignored.
  .passthrough();

function normalizeCommand(cmd: string | string[] | undefined): string | null {
  if (cmd === undefined) return null;
  return Array.isArray(cmd) ? cmd.join(" ") : cmd;
}

export function defaultDevcontainer(defaultImage: string): ResolvedDevcontainerConfig {
  return {
    image: defaultImage,
    postCreateCommand: null,
    forwardPorts: [],
    containerEnv: {},
    remoteUser: "node",
    workspaceFolder: "/workspace",
  };
}

/** Parses devcontainer.json text into a resolved config. Throws on invalid input. */
export function parseDevcontainer(raw: string, defaultImage: string): ResolvedDevcontainerConfig {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("devcontainer.json is not valid JSON");
  }
  const result = devcontainerSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Invalid devcontainer.json: ${issue.path.join(".")} ${issue.message}`.trim());
  }
  const v = result.data;
  const fallback = defaultDevcontainer(defaultImage);
  return {
    image: v.image,
    postCreateCommand: normalizeCommand(v.postCreateCommand),
    forwardPorts: v.forwardPorts ?? [],
    containerEnv: v.containerEnv ?? {},
    remoteUser: v.remoteUser ?? fallback.remoteUser,
    workspaceFolder: v.workspaceFolder ?? fallback.workspaceFolder,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w services/collab run test -- devcontainer-config.test`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add services/collab/src/environments/devcontainer-config.ts services/collab/src/environments/devcontainer-config.test.ts
git commit -m "feat(collab): devcontainer.json parsing with field whitelist"
```

### Task 4: Load the devcontainer for a project from disk

**Files:**
- Modify: `services/collab/src/environments/devcontainer-config.ts`
- Test: `services/collab/src/environments/devcontainer-config.test.ts`

- [ ] **Step 1: Write the failing test** — append:

```typescript
import { describe as describe2, it as it2, expect as expect2, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadProjectDevcontainer } from "./devcontainer-config.js";

describe2("loadProjectDevcontainer", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "syncdev-dc-"));
    mkdirSync(join(dir, "proj-with", ".devcontainer"), { recursive: true });
    writeFileSync(
      join(dir, "proj-with", ".devcontainer", "devcontainer.json"),
      JSON.stringify({ image: "python:3.12" }),
    );
    mkdirSync(join(dir, "proj-without"), { recursive: true });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it2("reads an existing devcontainer.json", () => {
    const cfg = loadProjectDevcontainer(join(dir, "proj-with"), DEFAULT_IMAGE);
    expect2(cfg.image).toBe("python:3.12");
  });

  it2("falls back to the default when absent", () => {
    const cfg = loadProjectDevcontainer(join(dir, "proj-without"), DEFAULT_IMAGE);
    expect2(cfg.image).toBe(DEFAULT_IMAGE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w services/collab run test -- devcontainer-config.test`
Expected: FAIL — `loadProjectDevcontainer` not exported.

- [ ] **Step 3: Implement** — append to `devcontainer-config.ts`:

```typescript
import { existsSync, readFileSync } from "fs";
import { join } from "path";

/** Loads `.devcontainer/devcontainer.json` from a workspace dir, or the default. */
export function loadProjectDevcontainer(
  workspaceDir: string,
  defaultImage: string,
): ResolvedDevcontainerConfig {
  const path = join(workspaceDir, ".devcontainer", "devcontainer.json");
  if (!existsSync(path)) return defaultDevcontainer(defaultImage);
  return parseDevcontainer(readFileSync(path, "utf-8"), defaultImage);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w services/collab run test -- devcontainer-config.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/collab/src/environments/devcontainer-config.ts services/collab/src/environments/devcontainer-config.test.ts
git commit -m "feat(collab): load project devcontainer from disk"
```

---

## Phase 3 — Docker driver

### Task 5: DockerDriver interface and real implementation

**Files:**
- Create: `services/collab/src/environments/docker-driver.ts`

This is an infrastructure adapter (shells out to `docker`); it is exercised by the gated integration test later, not unit-tested. Mirror the hardening flags from `services/collab/src/lib/sandbox.ts`.

- [ ] **Step 1: Create the file**

```typescript
import { execFile } from "child_process";
import type { ContainerInspect, ExecResult, RunOptions } from "./types.js";
import { logError } from "../lib/logger.js";

/** Abstraction over the Docker CLI so the manager can be unit-tested with a fake. */
export interface DockerDriver {
  pull(image: string): Promise<void>;
  run(opts: RunOptions): Promise<void>;
  start(name: string): Promise<void>;
  exec(name: string, command: string, timeoutMs: number): Promise<ExecResult>;
  stop(name: string): Promise<void>;
  rm(name: string): Promise<void>;
  inspect(name: string): Promise<ContainerInspect>;
}

const MAX_OUTPUT = 100_000;
function truncate(s: string): string {
  return s.length <= MAX_OUTPUT ? s : s.slice(0, MAX_OUTPUT) + "\n... (truncated)";
}

function docker(args: string[], timeoutMs: number): Promise<ExecResult> {
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
              ? ((error as { code: number }).code)
              : 0,
        });
      },
    );
    child.on("error", reject);
  });
}

export function createDockerDriver(): DockerDriver {
  return {
    async pull(image) {
      await docker(["pull", image], 300_000);
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
    exec(name, command, timeoutMs) {
      return docker(["exec", name, "sh", "-lc", command], timeoutMs);
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
      const res = await docker(
        ["inspect", "-f", "{{.State.Running}}", name],
        10_000,
      ).catch(() => ({ stdout: "", stderr: "", exitCode: 1 }) as ExecResult);
      if (res.exitCode !== 0) return { exists: false, running: false };
      return { exists: true, running: res.stdout.trim() === "true" };
    },
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm -w services/collab run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add services/collab/src/environments/docker-driver.ts
git commit -m "feat(collab): DockerDriver interface and CLI implementation"
```

---

## Phase 4 — Environment manager (TDD with a fake driver)

### Task 6: Manager skeleton, status and ensureRunning happy path

**Files:**
- Create: `services/collab/src/environments/environment-manager.ts`
- Test: `services/collab/src/environments/environment-manager.test.ts`

The manager takes its dependencies by injection: a `DockerDriver`, a config
loader `(projectId) => ResolvedDevcontainerConfig`, a host-path resolver
`(projectId) => string`, an options factory, and an optional event sink.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EnvironmentManager } from "./environment-manager.js";
import type { DockerDriver } from "./docker-driver.js";
import type { ResolvedDevcontainerConfig } from "./types.js";

const CONFIG: ResolvedDevcontainerConfig = {
  image: "node:20",
  postCreateCommand: "npm install",
  forwardPorts: [],
  containerEnv: {},
  remoteUser: "node",
  workspaceFolder: "/workspace",
};

function fakeDriver(overrides: Partial<DockerDriver> = {}): DockerDriver {
  return {
    pull: vi.fn().mockResolvedValue(undefined),
    run: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
    stop: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn().mockResolvedValue({ exists: false, running: false }),
    ...overrides,
  };
}

function makeManager(driver: DockerDriver) {
  return new EnvironmentManager({
    driver,
    loadConfig: () => CONFIG,
    hostWorkspacePath: (pid) => `/host/workspaces/${pid}`,
    limits: { memory: "512m", cpus: "1", pidsLimit: 512, network: "bridge", maxActive: 5 },
    now: () => 1000,
  });
}

describe("EnvironmentManager.ensureRunning", () => {
  let driver: DockerDriver;
  beforeEach(() => {
    driver = fakeDriver();
  });

  it("starts a stopped environment: pull, run, postCreate, running", async () => {
    const mgr = makeManager(driver);
    const state = await mgr.ensureRunning("proj-1");
    expect(state.status).toBe("running");
    expect(state.setupFailed).toBe(false);
    expect(driver.pull).toHaveBeenCalledWith("node:20");
    expect(driver.run).toHaveBeenCalledOnce();
    expect(driver.exec).toHaveBeenCalledWith("syncdev-env-proj-1", "npm install", expect.any(Number));
  });

  it("is idempotent when already running", async () => {
    const mgr = makeManager(driver);
    await mgr.ensureRunning("proj-1");
    await mgr.ensureRunning("proj-1");
    expect(driver.run).toHaveBeenCalledOnce();
  });

  it("dedupes concurrent ensureRunning calls", async () => {
    const mgr = makeManager(driver);
    await Promise.all([mgr.ensureRunning("proj-1"), mgr.ensureRunning("proj-1")]);
    expect(driver.run).toHaveBeenCalledOnce();
  });

  it("status returns stopped for an unknown project", () => {
    const mgr = makeManager(driver);
    expect(mgr.status("nope").status).toBe("stopped");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w services/collab run test -- environment-manager.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
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
    this.deps.onEvent?.(state.projectId, { type: "status", status, setupFailed: state.setupFailed });
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
        const res = await this.deps.driver.exec(
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
    if (victim) void this.stop(victim.projectId, true);
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
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w services/collab run test -- environment-manager.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add services/collab/src/environments/environment-manager.ts services/collab/src/environments/environment-manager.test.ts
git commit -m "feat(collab): environment manager start/status with injected driver"
```

### Task 7: exec, error states, setupFailed, rebuild and max-active eviction

**Files:**
- Modify: `services/collab/src/environments/environment-manager.ts`
- Test: `services/collab/src/environments/environment-manager.test.ts`

- [ ] **Step 1: Write the failing tests** — append:

```typescript
describe("EnvironmentManager.exec / error / rebuild / eviction", () => {
  it("execs a command in the running container after ensuring it", async () => {
    const driver = fakeDriver({
      exec: vi.fn().mockResolvedValue({ stdout: "hi", stderr: "", exitCode: 0 }),
    });
    const mgr = makeManager(driver);
    const res = await mgr.exec("proj-1", "echo hi", 30_000);
    expect(res.stdout).toBe("hi");
    expect(driver.run).toHaveBeenCalledOnce();
  });

  it("marks status error when run fails", async () => {
    const driver = fakeDriver({ run: vi.fn().mockRejectedValue(new Error("boom")) });
    const mgr = makeManager(driver);
    const state = await mgr.ensureRunning("proj-1");
    expect(state.status).toBe("error");
  });

  it("sets setupFailed when postCreateCommand exits non-zero", async () => {
    const driver = fakeDriver({
      exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "nope", exitCode: 1 }),
    });
    const mgr = makeManager(driver);
    const state = await mgr.ensureRunning("proj-1");
    expect(state.status).toBe("running");
    expect(state.setupFailed).toBe(true);
  });

  it("rebuild removes the container then starts fresh", async () => {
    const driver = fakeDriver();
    const mgr = makeManager(driver);
    await mgr.ensureRunning("proj-1");
    await mgr.rebuild("proj-1");
    expect(driver.rm).toHaveBeenCalledWith("syncdev-env-proj-1");
    expect(driver.run).toHaveBeenCalledTimes(2);
  });

  it("evicts the least-recently-active env when at maxActive", async () => {
    let t = 0;
    const driver = fakeDriver();
    const mgr = new EnvironmentManager({
      driver,
      loadConfig: () => CONFIG,
      hostWorkspacePath: (pid) => `/h/${pid}`,
      limits: { memory: "512m", cpus: "1", pidsLimit: 512, network: "bridge", maxActive: 1 },
      now: () => ++t,
    });
    await mgr.ensureRunning("proj-a");
    await mgr.ensureRunning("proj-b");
    expect(driver.rm).toHaveBeenCalledWith("syncdev-env-proj-a");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w services/collab run test -- environment-manager.test`
Expected: FAIL — `exec`/`rebuild` not defined.

- [ ] **Step 3: Add `exec` and `rebuild` methods** to the `EnvironmentManager` class (before the closing brace):

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w services/collab run test -- environment-manager.test`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add services/collab/src/environments/environment-manager.ts services/collab/src/environments/environment-manager.test.ts
git commit -m "feat(collab): environment manager exec, rebuild and eviction"
```

---

## Phase 5 — Presence and lifecycle (TDD)

### Task 8: Per-project presence tracking

**Files:**
- Create: `services/collab/src/environments/presence.ts`
- Test: `services/collab/src/environments/presence.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ProjectPresence } from "./presence.js";

function projectOf(roomId: string): string {
  return roomId.includes("::") ? roomId.split("::")[0] : roomId;
}

describe("ProjectPresence", () => {
  let p: ProjectPresence;
  beforeEach(() => {
    p = new ProjectPresence(projectOf);
  });

  it("counts clients across a project's rooms", () => {
    p.clientJoined("proj::a.ts");
    p.clientJoined("proj::b.ts");
    expect(p.count("proj")).toBe(2);
  });

  it("fires onProjectActive on the first client and onProjectEmpty on the last", () => {
    const active: string[] = [];
    const empty: string[] = [];
    p.onProjectActive((id) => active.push(id));
    p.onProjectEmpty((id) => empty.push(id));

    p.clientJoined("proj::a.ts");
    p.clientJoined("proj::b.ts");
    expect(active).toEqual(["proj"]);

    p.clientLeft("proj::a.ts");
    expect(empty).toEqual([]);
    p.clientLeft("proj::b.ts");
    expect(empty).toEqual(["proj"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w services/collab run test -- presence.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
type Listener = (projectId: string) => void;

/** Aggregates per-project client counts from per-room join/leave signals. */
export class ProjectPresence {
  private readonly counts = new Map<string, number>();
  private readonly activeListeners: Listener[] = [];
  private readonly emptyListeners: Listener[] = [];

  constructor(private readonly projectOf: (roomId: string) => string) {}

  onProjectActive(fn: Listener): void {
    this.activeListeners.push(fn);
  }
  onProjectEmpty(fn: Listener): void {
    this.emptyListeners.push(fn);
  }

  count(projectId: string): number {
    return this.counts.get(projectId) ?? 0;
  }

  clientJoined(roomId: string): void {
    const id = this.projectOf(roomId);
    const next = (this.counts.get(id) ?? 0) + 1;
    this.counts.set(id, next);
    if (next === 1) this.activeListeners.forEach((fn) => fn(id));
  }

  clientLeft(roomId: string): void {
    const id = this.projectOf(roomId);
    const next = Math.max(0, (this.counts.get(id) ?? 0) - 1);
    if (next === 0) {
      this.counts.delete(id);
      this.emptyListeners.forEach((fn) => fn(id));
    } else {
      this.counts.set(id, next);
    }
  }
}

function projectOf(roomId: string): string {
  return roomId.includes("::") ? roomId.split("::")[0] : roomId;
}

/** Process-wide presence instance shared by the room manager and lifecycle. */
export const projectPresence = new ProjectPresence(projectOf);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w services/collab run test -- presence.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add services/collab/src/environments/presence.ts services/collab/src/environments/presence.test.ts
git commit -m "feat(collab): per-project presence tracking"
```

### Task 9: Idle-stop lifecycle

**Files:**
- Create: `services/collab/src/environments/lifecycle.ts`
- Test: `services/collab/src/environments/lifecycle.test.ts`

- [ ] **Step 1: Write the failing test** (uses fake timers):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProjectPresence } from "./presence.js";
import { wireIdleStop } from "./lifecycle.js";

describe("wireIdleStop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stops a project after the idle delay once empty", () => {
    const presence = new ProjectPresence((r) => r);
    const stop = vi.fn();
    wireIdleStop(presence, { idleMs: 1000, stop });

    presence.clientJoined("proj");
    presence.clientLeft("proj");
    expect(stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(stop).toHaveBeenCalledWith("proj");
  });

  it("cancels the stop if a client reconnects within the delay", () => {
    const presence = new ProjectPresence((r) => r);
    const stop = vi.fn();
    wireIdleStop(presence, { idleMs: 1000, stop });

    presence.clientJoined("proj");
    presence.clientLeft("proj");
    vi.advanceTimersByTime(500);
    presence.clientJoined("proj");
    vi.advanceTimersByTime(1000);
    expect(stop).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w services/collab run test -- lifecycle.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (pure — no dependency on the manager singleton, so the unit test loads cleanly; `initEnvironmentLifecycle` lives in the singleton module in Task 11):

```typescript
import type { ProjectPresence } from "./presence.js";

export interface IdleStopDeps {
  readonly idleMs: number;
  readonly stop: (projectId: string) => void;
}

/** Stops a project's environment after it has had no clients for `idleMs`. */
export function wireIdleStop(presence: ProjectPresence, deps: IdleStopDeps): void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  presence.onProjectActive((projectId) => {
    const t = timers.get(projectId);
    if (t) {
      clearTimeout(t);
      timers.delete(projectId);
    }
  });

  presence.onProjectEmpty((projectId) => {
    const t = setTimeout(() => {
      timers.delete(projectId);
      deps.stop(projectId);
    }, deps.idleMs);
    timers.set(projectId, t);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w services/collab run test -- lifecycle.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add services/collab/src/environments/lifecycle.ts services/collab/src/environments/lifecycle.test.ts
git commit -m "feat(collab): idle-stop lifecycle for environments"
```

---

## Phase 6 — Wiring the singleton, events hub and server integration

### Task 10: SSE events hub

**Files:**
- Create: `services/collab/src/environments/events.ts`

Mirrors the `sseClients` pattern in `services/collab/src/api/preview.ts`. Only
depends on `environment-manager.ts` (for the `EnvironmentEvent` type), so it is
created before the singleton that imports it.

- [ ] **Step 1: Create the file**

```typescript
import type { ServerResponse } from "http";
import type { EnvironmentEvent } from "./environment-manager.js";

const clients = new Map<string, Set<ServerResponse>>();

export function addEnvironmentEventClient(projectId: string, res: ServerResponse): void {
  if (!clients.has(projectId)) clients.set(projectId, new Set());
  clients.get(projectId)!.add(res);
}

export function removeEnvironmentEventClient(projectId: string, res: ServerResponse): void {
  clients.get(projectId)?.delete(res);
  if (clients.get(projectId)?.size === 0) clients.delete(projectId);
}

export function emitEnvironmentEvent(projectId: string, event: EnvironmentEvent): void {
  const set = clients.get(projectId);
  if (!set) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm -w services/collab run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add services/collab/src/environments/events.ts
git commit -m "feat(collab): SSE event hub for environment status"
```

### Task 11: Manager singleton and lifecycle init

**Files:**
- Create: `services/collab/src/environments/environment-manager-instance.ts`

Builds the real manager once (wiring config, the real driver, the host-path
resolver mirroring `terminal.ts`, and the events hub), and exposes
`initEnvironmentLifecycle()` which connects presence to the manager's idle stop.

- [ ] **Step 1: Create the file**

```typescript
import { join } from "path";
import { loadConfig } from "../lib/config.js";
import { createDockerDriver } from "./docker-driver.js";
import { EnvironmentManager } from "./environment-manager.js";
import { loadProjectDevcontainer } from "./devcontainer-config.js";
import { emitEnvironmentEvent } from "./events.js";
import { wireIdleStop } from "./lifecycle.js";
import { projectPresence } from "./presence.js";
import { log } from "../lib/logger.js";

const WORKSPACE_BASE = process.env.TERMINAL_WORKSPACE_DIR ?? "./storage/workspaces";

function safeId(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Host path of a project's workspace (mirrors terminal.ts translation). */
function hostWorkspacePath(projectId: string): string {
  const cfg = loadConfig();
  const base = cfg.terminal.hostWorkspaceBase || WORKSPACE_BASE;
  return join(base, safeId(projectId));
}

/** Container-local path used to read the devcontainer.json. */
function localWorkspacePath(projectId: string): string {
  return join(WORKSPACE_BASE, safeId(projectId));
}

let instance: EnvironmentManager | null = null;

export function getEnvironmentManager(): EnvironmentManager {
  if (instance) return instance;
  const cfg = loadConfig();
  instance = new EnvironmentManager({
    driver: createDockerDriver(),
    loadConfig: (projectId) =>
      loadProjectDevcontainer(localWorkspacePath(projectId), cfg.environments.defaultImage),
    hostWorkspacePath,
    limits: {
      memory: cfg.terminal.memory,
      cpus: cfg.terminal.cpus,
      pidsLimit: cfg.terminal.pidsLimit,
      network: cfg.terminal.network,
      maxActive: cfg.environments.maxActive,
    },
    onEvent: (projectId, event) => emitEnvironmentEvent(projectId, event),
  });
  return instance;
}

/** Wires presence to the manager's idle stop. Call once at startup. */
export function initEnvironmentLifecycle(): void {
  const cfg = loadConfig();
  if (!cfg.environments.enabled) return;
  wireIdleStop(projectPresence, {
    idleMs: cfg.environments.idleMs,
    stop: (projectId) => {
      log("env", `stopping idle environment "${projectId}"`);
      void getEnvironmentManager().stop(projectId);
    },
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm -w services/collab run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add services/collab/src/environments/environment-manager-instance.ts
git commit -m "feat(collab): environment manager singleton and lifecycle init"
```

### Task 12: Room manager → presence, and server lifecycle init

**Files:**
- Modify: `services/collab/src/rooms/room-manager.ts`
- Modify: `services/collab/src/server.ts`

- [ ] **Step 1: Notify presence from the room manager.** In `room-manager.ts`, add the import:

```typescript
import { projectPresence } from "../environments/presence.js";
```

In `addClient`, after `room.clients.add(ws);`:

```typescript
  projectPresence.clientJoined(room.id);
```

In `removeClient`, after `room.clients.delete(ws);`:

```typescript
  projectPresence.clientLeft(room.id);
```

- [ ] **Step 2: Init the lifecycle at startup.** In `server.ts`, add the import:

```typescript
import { initEnvironmentLifecycle } from "./environments/environment-manager-instance.js";
```

After `initRoomManager();`:

```typescript
initEnvironmentLifecycle();
```

- [ ] **Step 3: Verify build and existing tests**

Run: `npm -w services/collab run build && npm -w services/collab run test`
Expected: build exit 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add services/collab/src/rooms/room-manager.ts services/collab/src/server.ts
git commit -m "feat(collab): wire presence into room manager and start lifecycle"
```

---

## Phase 7 — API and terminal integration

### Task 13: Environment REST + SSE handlers

**Files:**
- Create: `services/collab/src/api/environments.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { IncomingMessage, ServerResponse } from "http";
import { getEnvironmentManager } from "../environments/environment-manager-instance.js";
import {
  addEnvironmentEventClient,
  removeEnvironmentEventClient,
} from "../environments/events.js";
import { buildCorsHeaders, writeJson } from "../lib/http.js";
import { logError } from "../lib/logger.js";

/** GET /api/env/:projectId — current status. */
export function handleEnvStatus(res: ServerResponse, projectId: string, origin?: string): void {
  const s = getEnvironmentManager().status(projectId);
  writeJson(res, 200, { status: s.status, setupFailed: s.setupFailed }, origin);
}

/** POST /api/env/:projectId/start | rebuild | stop */
export async function handleEnvAction(
  res: ServerResponse,
  projectId: string,
  action: "start" | "rebuild" | "stop",
  origin?: string,
): Promise<void> {
  const mgr = getEnvironmentManager();
  try {
    if (action === "start") await mgr.ensureRunning(projectId);
    else if (action === "rebuild") await mgr.rebuild(projectId);
    else await mgr.stop(projectId);
    const s = mgr.status(projectId);
    writeJson(res, 200, { status: s.status, setupFailed: s.setupFailed }, origin);
  } catch (err) {
    logError("api", `env ${action} failed`, err);
    writeJson(res, 500, { error: "internal error" }, origin);
  }
}

/** GET /api/env/:projectId/events — SSE status stream. */
export function handleEnvEvents(
  req: IncomingMessage,
  res: ServerResponse,
  projectId: string,
  origin?: string,
): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...buildCorsHeaders(origin),
  });
  res.write("data: connected\n\n");
  addEnvironmentEventClient(projectId, res);
  req.on("close", () => removeEnvironmentEventClient(projectId, res));
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm -w services/collab run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add services/collab/src/api/environments.ts
git commit -m "feat(collab): environment REST and SSE handlers"
```

### Task 14: Route the environment endpoints

**Files:**
- Modify: `services/collab/src/api/routes.ts`

- [ ] **Step 1: Add the import** near the other handler imports:

```typescript
import { handleEnvStatus, handleEnvAction, handleEnvEvents } from "./environments.js";
```

- [ ] **Step 2: Add the routes.** Immediately after the `// POST /api/sync/:projectId` block in `handleApiRequest`, insert:

```typescript
  // GET /api/env/:projectId/events — SSE status stream
  const envEventsMatch = url.match(/^\/api\/env\/([^/?]+)\/events/);
  if (envEventsMatch && method === "GET") {
    const pid = decodeURIComponent(envEventsMatch[1]);
    if (!authorize(pid)) return true;
    handleEnvEvents(req, res, pid, origin);
    return true;
  }

  // POST /api/env/:projectId/start | rebuild | stop
  const envActionMatch = url.match(/^\/api\/env\/([^/?]+)\/(start|rebuild|stop)/);
  if (envActionMatch && method === "POST") {
    const pid = decodeURIComponent(envActionMatch[1]);
    if (!authorize(pid)) return true;
    await handleEnvAction(res, pid, envActionMatch[2] as "start" | "rebuild" | "stop", origin);
    return true;
  }

  // GET /api/env/:projectId — status
  const envStatusMatch = url.match(/^\/api\/env\/([^/?]+)$/);
  if (envStatusMatch && method === "GET") {
    const pid = decodeURIComponent(envStatusMatch[1]);
    if (!authorize(pid)) return true;
    handleEnvStatus(res, pid, origin);
    return true;
  }
```

- [ ] **Step 3: Add `/api/env/` to the rate-limited sensitive routes.** Change the `SENSITIVE_ROUTE` regex near the top of the file to:

```typescript
const SENSITIVE_ROUTE = /^\/api\/(terminal|clone|upload|scan|env)\//;
```

- [ ] **Step 4: Verify build**

Run: `npm -w services/collab run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add services/collab/src/api/routes.ts
git commit -m "feat(collab): route environment endpoints with authz"
```

### Task 15: Route terminal commands through the environment

**Files:**
- Modify: `services/collab/src/api/terminal.ts`

- [ ] **Step 1: Add the import**

```typescript
import { getEnvironmentManager } from "../environments/environment-manager-instance.js";
```

- [ ] **Step 2: Branch on the feature flag.** In `handleTerminalRequest`, replace the executor selection block (the `if (config.terminal.useDocker) { ... } else { ... }` inside the `try`) with:

```typescript
    let result;
    if (config.environments.enabled) {
      result = await getEnvironmentManager().exec(projectId, command, timeoutMs);
    } else if (config.terminal.useDocker) {
      const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
      const mountSource = config.terminal.hostWorkspaceBase
        ? join(config.terminal.hostWorkspaceBase, safeId)
        : cwd;
      result = await runInDocker(mountSource, command, timeoutMs, projectId);
    } else {
      result = await executeCommand(command, cwd, timeoutMs);
    }
    writeJson(res, 200, result);
```

- [ ] **Step 3: Verify build and tests**

Run: `npm -w services/collab run build && npm -w services/collab run test`
Expected: build exit 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add services/collab/src/api/terminal.ts
git commit -m "feat(collab): run terminal commands in the project environment"
```

---

## Phase 8 — Web UI

### Task 16: Web client API for environments

**Files:**
- Create: `apps/web/src/lib/env-api.ts`

- [ ] **Step 1: Create the file** (reuses `getApiBase` + the token wrapper pattern from `api.ts`; here we inline a small authed helper to avoid circular imports):

```typescript
import { getApiBase } from "./api";
import { getCollabToken, getCachedCollabToken } from "./collab-token";

export type EnvStatus = "stopped" | "building" | "running" | "error";

export interface EnvState {
  readonly status: EnvStatus;
  readonly setupFailed: boolean;
}

async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getCollabToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${getApiBase()}${path}`, { ...init, headers });
}

export async function getEnvStatus(projectId: string): Promise<EnvState> {
  const res = await authed(`/api/env/${encodeURIComponent(projectId)}`);
  if (!res.ok) throw new Error(`env status failed: ${res.status}`);
  return res.json();
}

export async function envAction(
  projectId: string,
  action: "start" | "rebuild" | "stop",
): Promise<EnvState> {
  const res = await authed(`/api/env/${encodeURIComponent(projectId)}/${action}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`env ${action} failed: ${res.status}`);
  return res.json();
}

/** Subscribes to SSE status events. Returns an unsubscribe function. */
export function subscribeEnvEvents(
  projectId: string,
  onEvent: (e: { type: string; status?: EnvStatus; setupFailed?: boolean; line?: string }) => void,
): () => void {
  const token = getCachedCollabToken();
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  const es = new EventSource(`${getApiBase()}/api/env/${encodeURIComponent(projectId)}/events${q}`);
  es.onmessage = (ev) => {
    if (ev.data === "connected") return;
    try {
      onEvent(JSON.parse(ev.data));
    } catch {
      /* ignore non-JSON keepalives */
    }
  };
  return () => es.close();
}
```

- [ ] **Step 2: Verify it type-checks** via the web build later (Task 18). For now:

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors in `env-api.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/env-api.ts
git commit -m "feat(web): environment client API"
```

### Task 17: Environment panel component

**Files:**
- Create: `apps/web/src/components/environment/EnvironmentPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { type EnvState, type EnvStatus, getEnvStatus, envAction, subscribeEnvEvents } from "@/lib/env-api";

interface EnvironmentPanelProps {
  readonly projectId: string;
}

const LABEL: Record<EnvStatus, string> = {
  stopped: "Stopped",
  building: "Building…",
  running: "Running",
  error: "Error",
};

const DOT: Record<EnvStatus, string> = {
  stopped: "bg-surface-500",
  building: "bg-amber-400 animate-pulse",
  running: "bg-emerald-400",
  error: "bg-red-500",
};

export function EnvironmentPanel({ projectId }: EnvironmentPanelProps) {
  const [state, setState] = useState<EnvState>({ status: "stopped", setupFailed: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getEnvStatus(projectId)
      .then((s) => active && setState(s))
      .catch(() => {});
    const unsub = subscribeEnvEvents(projectId, (e) => {
      if (e.type === "status" && e.status) {
        setState({ status: e.status, setupFailed: e.setupFailed ?? false });
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, [projectId]);

  async function run(action: "start" | "rebuild" | "stop") {
    setBusy(true);
    try {
      setState(await envAction(projectId, action));
    } catch {
      /* surfaced via status */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
      <span className={`h-2 w-2 rounded-full ${DOT[state.status]}`} />
      <span className="font-medium text-surface-300">Env: {LABEL[state.status]}</span>
      {state.setupFailed && <span className="text-amber-400">(setup failed)</span>}
      <div className="ml-auto flex gap-1">
        <button
          disabled={busy || state.status === "running"}
          onClick={() => run("start")}
          className="rounded px-2 py-0.5 hover:bg-surface-700 disabled:opacity-40"
        >
          Start
        </button>
        <button
          disabled={busy}
          onClick={() => run("rebuild")}
          className="rounded px-2 py-0.5 hover:bg-surface-700 disabled:opacity-40"
        >
          Rebuild
        </button>
        <button
          disabled={busy || state.status === "stopped"}
          onClick={() => run("stop")}
          className="rounded px-2 py-0.5 hover:bg-surface-700 disabled:opacity-40"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it.** In `apps/web/src/app/editor/[roomId]/EditorPageClient.tsx`, add the import and derive the project id from the room id (the room id has the form `projectId::filePath`). Render the panel in the status/footer region next to the existing status bar.

```tsx
import { EnvironmentPanel } from "@/components/environment/EnvironmentPanel";
// near the top of the component body, where `roomId` is available:
const projectId = roomId.includes("::") ? roomId.split("::")[0] : roomId;
// in the footer/status JSX region:
<EnvironmentPanel projectId={projectId} />
```

If `roomId` is not directly in scope, derive it from the route param the file already uses for the editor; the `projectId` is the substring before `::`.

- [ ] **Step 3: Verify the web build**

Run: `npm -w apps/web run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/environment/EnvironmentPanel.tsx apps/web/src/app/editor/[roomId]/EditorPageClient.tsx
git commit -m "feat(web): environment status panel"
```

### Task 17b: "Create environment" scaffolding

Implements the spec's "Create environment" action: write a starter
`.devcontainer/devcontainer.json` to the project workspace so the user has a
config to edit. The file is written directly to the workspace on disk (where the
environment manager reads it); the file tree refreshes on the next scan.

**Files:**
- Modify: `services/collab/src/api/environments.ts`
- Modify: `services/collab/src/api/routes.ts`
- Modify: `apps/web/src/lib/env-api.ts`
- Modify: `apps/web/src/components/environment/EnvironmentPanel.tsx`

- [ ] **Step 1: Backend handler.** Append to `services/collab/src/api/environments.ts`:

```typescript
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { loadConfig } from "../lib/config.js";

const ENV_WORKSPACE_BASE = process.env.TERMINAL_WORKSPACE_DIR ?? "./storage/workspaces";

/** POST /api/env/:projectId/scaffold — write a starter devcontainer.json. */
export function handleEnvScaffold(res: ServerResponse, projectId: string, origin?: string): void {
  const safe = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = join(ENV_WORKSPACE_BASE, safe, ".devcontainer");
  const file = join(dir, "devcontainer.json");
  if (existsSync(file)) {
    writeJson(res, 409, { error: "devcontainer.json already exists" }, origin);
    return;
  }
  mkdirSync(dir, { recursive: true });
  const content = JSON.stringify(
    { image: loadConfig().environments.defaultImage, postCreateCommand: "" },
    null,
    2,
  );
  writeFileSync(file, content + "\n", "utf-8");
  writeJson(res, 201, { created: true }, origin);
}
```

- [ ] **Step 2: Route it.** In `routes.ts`, add the import to the existing
  environments import line:

```typescript
import { handleEnvStatus, handleEnvAction, handleEnvEvents, handleEnvScaffold } from "./environments.js";
```

Add this route immediately before the `// POST /api/env/:projectId/start | rebuild | stop` block:

```typescript
  // POST /api/env/:projectId/scaffold — create a starter devcontainer.json
  const envScaffoldMatch = url.match(/^\/api\/env\/([^/?]+)\/scaffold/);
  if (envScaffoldMatch && method === "POST") {
    const pid = decodeURIComponent(envScaffoldMatch[1]);
    if (!authorize(pid)) return true;
    handleEnvScaffold(res, pid, origin);
    return true;
  }
```

- [ ] **Step 3: Client.** Append to `apps/web/src/lib/env-api.ts`:

```typescript
export async function scaffoldEnv(projectId: string): Promise<void> {
  const res = await authed(`/api/env/${encodeURIComponent(projectId)}/scaffold`, {
    method: "POST",
  });
  if (!res.ok && res.status !== 409) throw new Error(`scaffold failed: ${res.status}`);
}
```

- [ ] **Step 4: Panel button.** In `EnvironmentPanel.tsx`, import `scaffoldEnv`
  and add a button in the action row (before "Start"):

```tsx
// update the import:
import { type EnvState, type EnvStatus, getEnvStatus, envAction, scaffoldEnv, subscribeEnvEvents } from "@/lib/env-api";
// add a handler inside the component:
async function create() {
  setBusy(true);
  try {
    await scaffoldEnv(projectId);
  } finally {
    setBusy(false);
  }
}
// add this button as the first child of the action <div className="ml-auto flex gap-1">:
<button
  disabled={busy}
  onClick={create}
  className="rounded px-2 py-0.5 hover:bg-surface-700 disabled:opacity-40"
  title="Create a .devcontainer/devcontainer.json"
>
  Create
</button>
```

- [ ] **Step 5: Verify builds**

Run: `npm -w services/collab run build && npm -w apps/web run build`
Expected: collab exit 0; web `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add services/collab/src/api/environments.ts services/collab/src/api/routes.ts apps/web/src/lib/env-api.ts apps/web/src/components/environment/EnvironmentPanel.tsx
git commit -m "feat: create-environment scaffolding action"
```

---

## Phase 9 — Docs, coverage and final verification

### Task 18: Document env vars and add modules to the coverage gate

**Files:**
- Modify: `services/collab/.env.example`
- Modify: `services/collab/vitest.config.ts`

- [ ] **Step 1: Document the env vars.** Append to `services/collab/.env.example`:

```bash

# Reproducible environments (devcontainers)
# Run terminal commands in a persistent per-project container (default in prod).
ENVIRONMENTS_ENABLED=false
DEVCONTAINER_DEFAULT_IMAGE=mcr.microsoft.com/devcontainers/javascript-node:20
MAX_ACTIVE_ENVIRONMENTS=5
ENV_IDLE_MS=600000
```

- [ ] **Step 2: Add the unit-tested modules to coverage `include`.** In `services/collab/vitest.config.ts`, extend the `coverage.include` array with:

```typescript
        "src/environments/devcontainer-config.ts",
        "src/environments/environment-manager.ts",
        "src/environments/presence.ts",
        "src/environments/lifecycle.ts",
```

- [ ] **Step 3: Run the full coverage gate**

Run: `npm -w services/collab run test:coverage`
Expected: PASS, ≥80% on all metrics.

- [ ] **Step 4: Commit**

```bash
git add services/collab/.env.example services/collab/vitest.config.ts
git commit -m "docs(collab): document environment env vars and gate coverage"
```

### Task 19: Full CI-mirror verification

**Files:** none (verification only).

- [ ] **Step 1: Run every CI step**

```bash
npm run lint
npm run format:check
npm run build
npm -w apps/web run test
npm -w services/collab run test:coverage
```

Expected: all exit 0. If `format:check` fails, run `npm run format` and amend the relevant commit.

- [ ] **Step 2: Manual smoke (optional, needs Docker).** With `ENVIRONMENTS_ENABLED=true` and Docker running, start the dev stack, open a project, and confirm the Environment panel shows `Building…` then `Running`, and a terminal command (`node -v`) executes inside the container.

- [ ] **Step 3: Final commit if anything was amended; otherwise nothing to do.**

---

## Self-review notes

- **Spec coverage:** devcontainer parse+whitelist (T3/T4), persistent container + lazy start (T6), exec/rebuild/eviction (T7), presence (T8), idle-stop reusing presence (T9/T12), SSE events (T11/T13), REST gated by authz (T13/T14), terminal routing behind the flag (T15), config + defaults (T1), UI panel (T16/T17), the "Create environment" scaffolding action (T17b), security hardening reused in the driver run() flags (T5), testing via fake driver (T6/T7). The "stop not rm" strategy is realized: `stop(remove=false)` does `docker stop`, while `rebuild` and eviction pass `remove=true`.
- **Out of scope (honored):** no dev-server/streaming, no custom Dockerfile builds, no devcontainer `features`/`dockerComposeFile` (stripped by the whitelist).
- **Type consistency:** `EnvironmentManager` methods (`ensureRunning`, `exec`, `stop`, `rebuild`, `status`), `DockerDriver` methods (`pull/run/start/exec/stop/rm/inspect`), and `EnvironmentEvent` are used identically across tasks. `containerName` format `syncdev-env-<safeId>` matches the test assertions in T6/T7.
- **Known follow-up:** `forwardPorts` is parsed and stored but not yet acted on — it is consumed by the next feature (running-app preview), as the spec states.
