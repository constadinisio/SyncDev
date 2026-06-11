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
