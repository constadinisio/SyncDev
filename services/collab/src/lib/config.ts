/**
 * Centralized, validated runtime configuration.
 *
 * All environment access for the collab service goes through here so that:
 *  - Required variables are checked once, at boot (fail-fast).
 *  - The rest of the codebase consumes a typed, immutable config object.
 *
 * Import `config` anywhere; call `loadConfig()` once at startup to surface
 * misconfiguration before the server starts accepting traffic.
 */

type NodeEnv = "development" | "production" | "test";

export interface AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly isProduction: boolean;
  readonly port: number;
  readonly host: string;
  /** Allowlisted browser origins for CORS. Empty array means "same-origin only". */
  readonly allowedOrigins: readonly string[];
  readonly snapshotDir: string;
  readonly snapshotDebounceMs: number;
  readonly snapshotIntervalMs: number;
  readonly roomGracePeriodMs: number;
  readonly logLevel: string;
  /** Fixed-window rate limit for sensitive endpoints (terminal, clone, upload, scan). */
  readonly rateLimitWindowMs: number;
  readonly rateLimitMax: number;
  /** When true, every API/WS request must carry a valid token. Defaults to production. */
  readonly authEnforced: boolean;
  /** Shared HS256 secret used to verify tokens minted by the web app. */
  readonly collabJwtSecret: string | undefined;
  /** Terminal command isolation. */
  readonly terminal: TerminalSandboxConfig;
  /** Sentry DSN for error tracking. Undefined disables Sentry. */
  readonly sentryDsn: string | undefined;
}

export interface TerminalSandboxConfig {
  /** Run commands inside an ephemeral Docker container. Defaults to production. */
  readonly useDocker: boolean;
  readonly image: string;
  readonly memory: string;
  readonly cpus: string;
  readonly pidsLimit: number;
  /** Container network mode: "bridge" (outbound allowed) or "none" (offline). */
  readonly network: string;
  /**
   * Host path of the workspaces dir, used to translate bind mounts when this
   * service itself runs in a container and spawns sibling containers via the
   * host Docker socket. Empty means "paths are already host paths".
   */
  readonly hostWorkspaceBase: string;
}

class ConfigError extends Error {
  constructor(message: string) {
    super(`Invalid configuration: ${message}`);
    this.name = "ConfigError";
  }
}

function parseInteger(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 0) {
    throw new ConfigError(`${name} must be a non-negative integer, got "${raw}"`);
  }
  return value;
}

function parseBoolean(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === "") return fallback;
  const value = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  throw new ConfigError(`${name} must be a boolean (true/false), got "${raw}"`);
}

function parseNodeEnv(raw: string | undefined): NodeEnv {
  const value = raw ?? "development";
  if (value !== "development" && value !== "production" && value !== "test") {
    throw new ConfigError(`NODE_ENV must be development | production | test, got "${value}"`);
  }
  return value;
}

function parseOrigins(raw: string | undefined, isProduction: boolean): string[] {
  const origins = (raw ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (isProduction && origins.length === 0) {
    throw new ConfigError(
      "ALLOWED_ORIGINS is required in production (comma-separated list of browser origins)",
    );
  }
  if (isProduction && origins.includes("*")) {
    throw new ConfigError("ALLOWED_ORIGINS cannot be '*' in production");
  }

  // Sensible localhost defaults for local development only.
  if (origins.length === 0) {
    return ["http://localhost:3000", "http://127.0.0.1:3000"];
  }
  return origins;
}

let cached: AppConfig | null = null;

/**
 * Validates and freezes the configuration. Throws ConfigError on the first
 * invalid value. Safe to call multiple times; the result is memoized.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;

  const nodeEnv = parseNodeEnv(env.NODE_ENV);
  const isProduction = nodeEnv === "production";

  // Auth is enforced in production by default; can be toggled explicitly.
  const authEnforced = parseBoolean("AUTH_ENFORCED", env.AUTH_ENFORCED, isProduction);
  const collabJwtSecret = env.COLLAB_JWT_SECRET?.trim() || undefined;
  if (authEnforced && !collabJwtSecret) {
    throw new ConfigError(
      "COLLAB_JWT_SECRET is required when authentication is enforced (production)",
    );
  }
  if (collabJwtSecret && collabJwtSecret.length < 32) {
    throw new ConfigError("COLLAB_JWT_SECRET must be at least 32 characters");
  }

  const resolved: AppConfig = Object.freeze({
    nodeEnv,
    isProduction,
    port: parseInteger("PORT", env.PORT, 4000),
    host: env.HOST ?? "0.0.0.0",
    allowedOrigins: Object.freeze(parseOrigins(env.ALLOWED_ORIGINS, isProduction)),
    snapshotDir: env.SNAPSHOT_DIR ?? "./storage/snapshots",
    snapshotDebounceMs: parseInteger("SNAPSHOT_DEBOUNCE_MS", env.SNAPSHOT_DEBOUNCE_MS, 2000),
    snapshotIntervalMs: parseInteger("SNAPSHOT_INTERVAL_MS", env.SNAPSHOT_INTERVAL_MS, 30000),
    roomGracePeriodMs: parseInteger("ROOM_GRACE_PERIOD_MS", env.ROOM_GRACE_PERIOD_MS, 30000),
    logLevel: env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
    rateLimitWindowMs: parseInteger("RATE_LIMIT_WINDOW_MS", env.RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMax: parseInteger("RATE_LIMIT_MAX", env.RATE_LIMIT_MAX, 30),
    authEnforced,
    collabJwtSecret,
    terminal: Object.freeze({
      useDocker: parseBoolean("TERMINAL_SANDBOX_DOCKER", env.TERMINAL_SANDBOX_DOCKER, isProduction),
      image: env.SANDBOX_IMAGE ?? "node:20-bookworm-slim",
      memory: env.SANDBOX_MEMORY ?? "512m",
      cpus: env.SANDBOX_CPUS ?? "1",
      pidsLimit: parseInteger("SANDBOX_PIDS_LIMIT", env.SANDBOX_PIDS_LIMIT, 512),
      network: env.SANDBOX_NETWORK ?? "bridge",
      hostWorkspaceBase: env.SANDBOX_HOST_WORKSPACE_BASE?.trim() ?? "",
    }),
    sentryDsn: env.SENTRY_DSN?.trim() || undefined,
  });

  cached = resolved;
  return resolved;
}

/** Resets memoized config. For tests only. */
export function resetConfigForTests(): void {
  cached = null;
}

/** Returns true if the given Origin header value is allowed. */
export function isOriginAllowed(origin: string | undefined, cfg: AppConfig): boolean {
  if (!origin) return false;
  return cfg.allowedOrigins.includes(origin);
}
