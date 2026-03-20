import type { ServerResponse } from "http";
import { getRooms } from "../rooms/room-manager.js";

export function handleHistoryRequest(
  res: ServerResponse,
  projectId: string,
  filePath: string,
): void {
  const roomId = `${projectId}::${filePath}`;
  const rooms = getRooms();
  const room = rooms.get(roomId);

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (!room) {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ entries: [] }));
    return;
  }

  // Return the update log entries (most recent first)
  const entries = [...room.updateLog].reverse();
  res.writeHead(200, headers);
  res.end(JSON.stringify({ entries }));
}
