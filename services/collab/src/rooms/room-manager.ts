import type { WebSocket } from "ws";
import { createRoom, destroyRoom } from "./room.js";
import { loadSnapshot } from "../persistence/snapshot-store.js";
import {
  scheduleDebouncedSave,
  persistRoom,
  persistAllDirtyRooms,
  startPeriodicSave,
  stopPeriodicSave,
} from "../persistence/snapshot-manager.js";
import { ROOM_GRACE_PERIOD_MS } from "../persistence/constants.js";
import { log } from "../lib/logger.js";
import type { Room } from "../types/index.js";

const rooms = new Map<string, Room>();

export function getOrCreateRoom(roomId: string): Room {
  const existing = rooms.get(roomId);
  if (existing) {
    // Cancel pending destroy if someone reconnects
    if (existing.destroyTimer !== null) {
      clearTimeout(existing.destroyTimer);
      existing.destroyTimer = null;
      log("room", `cancelled destroy timer for room "${roomId}"`);
    }
    return existing;
  }

  const initialState = loadSnapshot(roomId);
  const room = createRoom(roomId, initialState);

  // Listen for doc updates to trigger debounced persistence
  room.doc.on("update", () => {
    scheduleDebouncedSave(room);
  });

  rooms.set(roomId, room);
  log("room", `created room "${roomId}" (restored: ${initialState !== null})`);
  return room;
}

export function addClient(room: Room, ws: WebSocket): void {
  room.clients.add(ws);
  log("room", `client joined room "${room.id}" (${room.clients.size} connected)`);
}

export function removeClient(room: Room, ws: WebSocket): void {
  room.clients.delete(ws);
  log("room", `client left room "${room.id}" (${room.clients.size} connected)`);

  if (room.clients.size === 0) {
    log("room", `room "${room.id}" is empty, starting grace period (${ROOM_GRACE_PERIOD_MS}ms)`);
    room.destroyTimer = setTimeout(() => {
      persistRoom(room);
      destroyRoom(room);
      rooms.delete(room.id);
      log("room", `destroyed room "${room.id}" after grace period`);
    }, ROOM_GRACE_PERIOD_MS);
  }
}

export function getRooms(): ReadonlyMap<string, Room> {
  return rooms;
}

export function initRoomManager(): void {
  startPeriodicSave(rooms);
}

export function shutdownRoomManager(): void {
  log("room", "shutting down room manager...");
  stopPeriodicSave();
  persistAllDirtyRooms(rooms);
  for (const room of rooms.values()) {
    destroyRoom(room);
  }
  rooms.clear();
  log("room", "room manager shut down");
}
