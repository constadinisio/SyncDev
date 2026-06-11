import type { ServerResponse } from "http";
import { getRooms } from "../rooms/room-manager.js";
import { writeJson } from "../lib/http.js";

export function handleHistoryRequest(
  res: ServerResponse,
  projectId: string,
  filePath: string,
  origin?: string,
): void {
  const roomId = `${projectId}::${filePath}`;
  const rooms = getRooms();
  const room = rooms.get(roomId);

  if (!room) {
    writeJson(res, 200, { entries: [] }, origin);
    return;
  }

  // Return the update log entries (most recent first)
  const entries = [...room.updateLog].reverse();
  writeJson(res, 200, { entries }, origin);
}
