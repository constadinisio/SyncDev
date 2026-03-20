import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { SNAPSHOT_DIR } from "./constants.js";
import { log, logError } from "../lib/logger.js";

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function snapshotPath(roomId: string): string {
  const safeId = roomId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(SNAPSHOT_DIR, `${safeId}.ystate`);
}

export function loadSnapshot(roomId: string): Uint8Array | null {
  const filePath = snapshotPath(roomId);
  if (!existsSync(filePath)) {
    log("snapshot", `no snapshot found for room "${roomId}"`);
    return null;
  }
  try {
    const buffer = readFileSync(filePath);
    log("snapshot", `loaded snapshot for room "${roomId}" (${buffer.byteLength} bytes)`);
    return new Uint8Array(buffer);
  } catch (err) {
    logError("snapshot", `failed to load snapshot for room "${roomId}"`, err);
    return null;
  }
}

export function saveSnapshot(roomId: string, state: Uint8Array): void {
  ensureDir(SNAPSHOT_DIR);
  const filePath = snapshotPath(roomId);
  const tmpPath = `${filePath}.tmp`;
  try {
    writeFileSync(tmpPath, state);
    renameSync(tmpPath, filePath);
    log("snapshot", `saved snapshot for room "${roomId}" (${state.byteLength} bytes)`);
  } catch (err) {
    logError("snapshot", `failed to save snapshot for room "${roomId}"`, err);
  }
}
