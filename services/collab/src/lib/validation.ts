import { z } from "zod";

/**
 * Shared request-validation schemas for the collab API.
 *
 * Every external payload is parsed through zod before use so that malformed
 * input fails fast with a clear 400 instead of corrupting state, and so that
 * path-like fields can never escape their project sandbox.
 */

/** Matches the on-disk projectId sanitization: alphanumerics, dot, dash, underscore. */
export const projectIdSchema = z
  .string()
  .min(1, "projectId is required")
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/, "projectId contains invalid characters");

/**
 * A project-relative path. Rejects absolute paths, parent traversal (`..`),
 * NUL bytes and backslashes so a path can never escape the workspace.
 */
export const relativePathSchema = z
  .string()
  .min(1, "path is required")
  .max(1024)
  .refine((p) => !p.includes("\0"), "path contains NUL byte")
  .refine((p) => !p.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(p), "path must be relative")
  .refine(
    (p) => !p.split(/[\\/]/).some((seg) => seg === ".."),
    "path must not traverse parent directories",
  );

/** A single file or folder name (no separators). */
export const nodeNameSchema = z
  .string()
  .min(1, "name is required")
  .max(255)
  .refine((n) => !/[\\/]/.test(n), "name must not contain path separators")
  .refine((n) => n !== "." && n !== "..", "invalid name");

export const createNodeSchema = z.object({
  path: relativePathSchema,
  type: z.enum(["file", "folder"]),
});

export const deleteNodeSchema = z.object({
  path: relativePathSchema,
});

export const moveNodeSchema = z.object({
  sourcePath: relativePathSchema,
  targetPath: z.string().max(1024), // may be "" for moving to root
});

export const renameNodeSchema = z.object({
  path: relativePathSchema,
  newName: nodeNameSchema,
});

export const createProjectSchema = z.object({
  projectId: projectIdSchema,
});

export const terminalSchema = z.object({
  command: z.string().min(1, "command is required").max(4000),
});

export const cloneSchema = z.object({
  repoUrl: z
    .string()
    .min(1, "repoUrl is required")
    .max(2048)
    .refine(
      (u) => /^https:\/\//.test(u) || /^git@/.test(u),
      "repoUrl must be an https:// or git@ URL",
    ),
});

/** Error carrying a human-readable, client-safe validation message. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Parses `raw` JSON text against `schema`. Throws ValidationError with a flat,
 * client-safe message on malformed JSON or schema mismatch.
 */
export function parseJson<T>(schema: z.ZodType<T>, raw: string): T {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ValidationError("request body is not valid JSON");
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join(".");
    throw new ValidationError(path ? `${path}: ${first.message}` : first.message);
  }
  return result.data;
}

/** Validates a value (e.g. a URL path segment) against a schema, throwing ValidationError. */
export function parseValue<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? "invalid value");
  }
  return result.data;
}
