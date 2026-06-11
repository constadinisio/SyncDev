import type { ServerResponse } from "http";
import { loadConfig, isOriginAllowed } from "./config.js";

/**
 * Builds CORS headers for a request, echoing back the Origin only when it is
 * on the configured allowlist. Unknown origins receive no CORS grant, so the
 * browser blocks the cross-origin read.
 */
export function buildCorsHeaders(origin: string | undefined): Record<string, string> {
  const config = loadConfig();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
  if (isOriginAllowed(origin, config)) {
    headers["Access-Control-Allow-Origin"] = origin as string;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

export function writeJson(
  res: ServerResponse,
  status: number,
  data: unknown,
  origin: string | undefined,
): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...buildCorsHeaders(origin),
  });
  res.end(JSON.stringify(data));
}
