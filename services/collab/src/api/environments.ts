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
