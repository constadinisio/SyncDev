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
