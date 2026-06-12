import { describe, it, expect, beforeEach, vi } from "vitest";
import { EnvironmentManager } from "./environment-manager.js";
import type { DockerDriver } from "./docker-driver.js";
import type { ResolvedDevcontainerConfig, RunOptions } from "./types.js";

const CONFIG: ResolvedDevcontainerConfig = {
  image: "node:20",
  postCreateCommand: "npm install",
  forwardPorts: [],
  containerEnv: {},
  remoteUser: "node",
  workspaceFolder: "/workspace",
};

/**
 * A fake driver that tracks container state, so `inspect` reflects reality
 * after run/start/stop/rm. This lets us exercise the manager's re-inspect
 * logic (crash auto-recovery) the same way the real Docker CLI would behave.
 */
function fakeDriver(overrides: Partial<DockerDriver> = {}): DockerDriver {
  const present = new Set<string>();
  const running = new Set<string>();
  return {
    pull: vi.fn().mockResolvedValue(undefined),
    run: vi.fn(async (opts: RunOptions) => {
      present.add(opts.name);
      running.add(opts.name);
    }),
    start: vi.fn(async (name: string) => {
      running.add(name);
    }),
    exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
    stop: vi.fn(async (name: string) => {
      running.delete(name);
    }),
    rm: vi.fn(async (name: string) => {
      running.delete(name);
      present.delete(name);
    }),
    inspect: vi.fn(async (name: string) => ({
      exists: present.has(name),
      running: running.has(name),
    })),
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
    expect(driver.exec).toHaveBeenCalledWith(
      "syncdev-env-proj-1",
      "npm install",
      expect.any(Number),
    );
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

  it("restarts a container that died while marked running", async () => {
    const mgr = makeManager(driver);
    await mgr.ensureRunning("proj-1");
    // Simulate an OOM/crash: the container exits but is not removed.
    await driver.stop("syncdev-env-proj-1");
    (driver.start as ReturnType<typeof vi.fn>).mockClear();

    const state = await mgr.ensureRunning("proj-1");

    expect(state.status).toBe("running");
    expect(driver.start).toHaveBeenCalledWith("syncdev-env-proj-1");
  });

  it("does not restart when the container is still alive", async () => {
    const mgr = makeManager(driver);
    await mgr.ensureRunning("proj-1");
    (driver.start as ReturnType<typeof vi.fn>).mockClear();
    (driver.run as ReturnType<typeof vi.fn>).mockClear();

    await mgr.ensureRunning("proj-1");

    expect(driver.start).not.toHaveBeenCalled();
    expect(driver.run).not.toHaveBeenCalled();
  });
});

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
