import { loadConfig } from "../lib/config.js";

// Re-exported from the validated config so the whole codebase shares one
// source of truth. loadConfig() is memoized and validates on first call.
const config = loadConfig();

export const SNAPSHOT_DIR = config.snapshotDir;
export const SNAPSHOT_DEBOUNCE_MS = config.snapshotDebounceMs;
export const SNAPSHOT_INTERVAL_MS = config.snapshotIntervalMs;
export const ROOM_GRACE_PERIOD_MS = config.roomGracePeriodMs;
