export const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR ?? "./storage/snapshots";
export const SNAPSHOT_DEBOUNCE_MS = parseInt(
  process.env.SNAPSHOT_DEBOUNCE_MS ?? "2000",
  10,
);
export const SNAPSHOT_INTERVAL_MS = parseInt(
  process.env.SNAPSHOT_INTERVAL_MS ?? "30000",
  10,
);
export const ROOM_GRACE_PERIOD_MS = parseInt(
  process.env.ROOM_GRACE_PERIOD_MS ?? "30000",
  10,
);
