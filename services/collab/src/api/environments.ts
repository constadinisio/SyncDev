import { existsSync, mkdirSync, writeFileSync } from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import { join } from "path";
import { getEnvironmentManager } from "../environments/environment-manager-instance.js";
import {
  addEnvironmentEventClient,
  removeEnvironmentEventClient,
} from "../environments/events.js";
import { buildCorsHeaders, writeJson } from "../lib/http.js";
import { loadConfig } from "../lib/config.js";
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
