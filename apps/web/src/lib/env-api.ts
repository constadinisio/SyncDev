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

export async function scaffoldEnv(projectId: string): Promise<void> {
  const res = await authed(`/api/env/${encodeURIComponent(projectId)}/scaffold`, {
    method: "POST",
  });
  if (!res.ok && res.status !== 409) throw new Error(`scaffold failed: ${res.status}`);
}
