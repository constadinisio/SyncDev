import type { ServerResponse } from "http";
import { syncProjectToDisk } from "../persistence/disk-sync.js";
import { log } from "../lib/logger.js";
import { writeJson } from "../lib/http.js";

export function handleSyncRequest(res: ServerResponse, projectId: string, origin?: string): void {
  log("sync", `syncing project "${projectId}" to disk...`);
  const count = syncProjectToDisk(projectId);
  writeJson(res, 200, { synced: count }, origin);
}
