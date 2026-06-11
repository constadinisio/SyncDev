import * as Y from "yjs";
import { saveSnapshot } from "./snapshot-store.js";
import { syncRoomToDisk, syncAllDirtyRoomsToDisk } from "./disk-sync.js";
import { SNAPSHOT_DEBOUNCE_MS, SNAPSHOT_INTERVAL_MS } from "./constants.js";
import { log } from "../lib/logger.js";
import type { Room } from "../types/index.js";

export function scheduleDebouncedSave(room: Room): void {
  if (room.persistTimer !== null) {
    clearTimeout(room.persistTimer);
  }
  room.dirty = true;
  room.persistTimer = setTimeout(() => {
    room.persistTimer = null;
    persistRoom(room);
  }, SNAPSHOT_DEBOUNCE_MS);
}

export function persistRoom(room: Room): void {
  if (!room.dirty) return;
  const state = Y.encodeStateAsUpdate(room.doc);
  saveSnapshot(room.id, state);
  // Also sync file content to disk so git can see changes
  syncRoomToDisk(room);
  room.dirty = false;
}

export function persistAllDirtyRooms(rooms: ReadonlyMap<string, Room>): void {
  for (const room of rooms.values()) {
    persistRoom(room);
  }
  // Bulk sync any remaining dirty files
  syncAllDirtyRoomsToDisk(rooms);
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startPeriodicSave(rooms: ReadonlyMap<string, Room>): void {
  if (intervalHandle !== null) return;
  intervalHandle = setInterval(() => {
    let saved = 0;
    for (const room of rooms.values()) {
      if (room.dirty) {
        persistRoom(room);
        saved++;
      }
    }
    if (saved > 0) {
      log("snapshot", `periodic save: ${saved} room(s)`);
    }
  }, SNAPSHOT_INTERVAL_MS);
}

export function stopPeriodicSave(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
