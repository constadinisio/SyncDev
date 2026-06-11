import type { ServerResponse } from "http";
import { syncProjectToDisk } from "../persistence/disk-sync.js";
import { log } from "../lib/logger.js";

export function handleSyncRequest(
  res: ServerResponse,
  projectId: string,
): void {
  log("sync", `syncing project "${projectId}" to disk...`);
  const count = syncProjectToDisk(projectId);

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify({ synced: count }));
}
