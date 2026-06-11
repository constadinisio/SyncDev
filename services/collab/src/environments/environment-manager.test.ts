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
