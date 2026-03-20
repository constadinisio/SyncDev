import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import {
  getOrCreateRoom,
  addClient,
  removeClient,
} from "../rooms/room-manager.js";
import {
  handleMessage,
  sendSyncStep1,
  sendAwarenessState,
} from "./message-handler.js";
import { notifyPreviewClients } from "../api/preview.js";
import { log, logError } from "../lib/logger.js";

const MESSAGE_AWARENESS = 1;

function extractRoomId(url: string): string | null {
  // URL format: /<roomId> where roomId is URL-encoded
  // The roomId may contain "::" (e.g., "projectId::path/to/file")
  const trimmed = url.replace(/^\/+/, "").split("?")[0];
  if (!trimmed) return null;
  return decodeURIComponent(trimmed);
}

export function handleConnection(ws: WebSocket, req: IncomingMessage): void {
  const roomId = extractRoomId(req.url ?? "");
  if (!roomId) {
    log("ws", "connection rejected: no room ID in URL");
    ws.close(4000, "Missing room ID");
    return;
  }

  const room = getOrCreateRoom(roomId);
  addClient(room, ws);

  // Send initial sync state to the new client
  sendSyncStep1(room, ws);

  // Send current awareness states
  sendAwarenessState(room, ws);

  // Broadcast awareness updates to other clients
  const awarenessChangeHandler = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    const changedClients = [...added, ...updated, ...removed];
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, changedClients),
    );
    const message = encoding.toUint8Array(encoder);

    for (const client of room.clients) {
      if (client !== origin && client.readyState === ws.OPEN) {
        client.send(message);
      }
    }
  };

  room.awareness.on("change", awarenessChangeHandler);

  // Debounced live preview reload — extract projectId from "projectId::filePath"
  let previewReloadTimer: ReturnType<typeof setTimeout> | null = null;
  const projectId = roomId.includes("::") ? roomId.split("::")[0] : null;

  // Broadcast doc updates to other clients
  const docUpdateHandler = (update: Uint8Array, origin: unknown) => {
    for (const client of room.clients) {
      if (client !== origin && client.readyState === ws.OPEN) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 0); // MESSAGE_SYNC
        encoding.writeVarUint(encoder, 2); // syncStep2
        encoding.writeVarUint8Array(encoder, update);
        client.send(encoding.toUint8Array(encoder));
      }
    }

    // Log the update with user info for history
    const localState = room.awareness.getStates().get(room.doc.clientID);
    const userName =
      (localState?.user as { name?: string } | undefined)?.name ?? "Unknown";
    // Also try to find user from the origin (ws) client awareness
    let logUser = userName;
    room.awareness.getStates().forEach((state) => {
      if (state.user && (state.user as { name?: string }).name) {
        logUser = (state.user as { name: string }).name;
      }
    });
    if (room.updateLog.length >= 100) {
      room.updateLog.shift();
    }
    room.updateLog.push({ user: logUser, timestamp: Date.now() });

    // Notify live preview with debounce (500ms)
    if (projectId) {
      if (previewReloadTimer) clearTimeout(previewReloadTimer);
      previewReloadTimer = setTimeout(() => {
        notifyPreviewClients(projectId);
        previewReloadTimer = null;
      }, 500);
    }
  };

  room.doc.on("update", docUpdateHandler);

  ws.on("message", (rawData: Buffer | ArrayBuffer | Buffer[]) => {
    try {
      const data =
        rawData instanceof ArrayBuffer
          ? new Uint8Array(rawData)
          : new Uint8Array(rawData as Buffer);
      handleMessage(room, ws, data);
    } catch (err) {
      logError("ws", `error handling message in room "${roomId}"`, err);
    }
  });

  ws.on("close", () => {
    if (previewReloadTimer) clearTimeout(previewReloadTimer);
    room.awareness.off("change", awarenessChangeHandler);
    room.doc.off("update", docUpdateHandler);
    awarenessProtocol.removeAwarenessStates(
      room.awareness,
      [room.doc.clientID],
      null,
    );
    removeClient(room, ws);
  });

  ws.on("error", (err) => {
    logError("ws", `websocket error in room "${roomId}"`, err);
  });

  log("ws", `client connected to room "${roomId}"`);
}
