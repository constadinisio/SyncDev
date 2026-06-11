import { z } from "zod";
import type { ResolvedDevcontainerConfig } from "./types.js";

/**
 * The ONLY devcontainer.json fields SyncDev honors. Anything else (privileged,
 * runArgs, mounts, features, dockerComposeFile, ...) is ignored so a project
 * cannot request host escalation through its committed config.
 */
const devcontainerSchema = z
  .object({
    image: z.string().min(1, "image is required").max(512),
    postCreateCommand: z.union([z.string().max(4000), z.array(z.string()).max(64)]).optional(),
    forwardPorts: z.array(z.number().int().min(1).max(65535)).max(32).optional(),
    containerEnv: z.record(z.string(), z.string()).optional(),
    remoteUser: z.string().max(64).optional(),
    workspaceFolder: z.string().max(512).optional(),
  })
  // Drop unknown keys instead of failing, so unsupported features are simply ignored.
  .passthrough();

function normalizeCommand(cmd: string | string[] | undefined): string | null {
  if (cmd === undefined) return null;
  return Array.isArray(cmd) ? cmd.join(" ") : cmd;
}

export function defaultDevcontainer(defaultImage: string): ResolvedDevcontainerConfig {
  return {
    image: defaultImage,
    postCreateCommand: null,
    forwardPorts: [],
    containerEnv: {},
    remoteUser: "node",
    workspaceFolder: "/workspace",
  };
}

/** Parses devcontainer.json text into a resolved config. Throws on invalid input. */
export function parseDevcontainer(raw: string, defaultImage: string): ResolvedDevcontainerConfig {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("devcontainer.json is not valid JSON");
  }
  const result = devcontainerSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Invalid devcontainer.json: ${issue.path.join(".")} ${issue.message}`.trim());
  }
  const v = result.data;
  const fallback = defaultDevcontainer(defaultImage);
  return {
    image: v.image,
    postCreateCommand: normalizeCommand(v.postCreateCommand),
    forwardPorts: v.forwardPorts ?? [],
    containerEnv: v.containerEnv ?? {},
    remoteUser: v.remoteUser ?? fallback.remoteUser,
    workspaceFolder: v.workspaceFolder ?? fallback.workspaceFolder,
  };
}
