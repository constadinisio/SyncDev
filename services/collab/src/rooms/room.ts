import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import type { Room } from "../types/index.js";

export function createRoom(id: string, initialState: Uint8Array | null): Room {
  const doc = new Y.Doc();

  if (initialState !== null) {
    Y.applyUpdate(doc, initialState);
  }

  // Ensure the shared text type exists
  doc.getText("content");

  const awareness = new Awareness(doc);

  return {
    id,
    doc,
    clients: new Set(),
    awareness,
    updateLog: [],
    persistTimer: null,
    destroyTimer: null,
    dirty: false,
  };
}

export function destroyRoom(room: Room): void {
  if (room.persistTimer !== null) {
    clearTimeout(room.persistTimer);
    room.persistTimer = null;
  }
  if (room.destroyTimer !== null) {
    clearTimeout(room.destroyTimer);
    room.destroyTimer = null;
  }
  room.awareness.destroy();
  room.doc.destroy();
  room.clients.clear();
}
