import { createServer } from "http";
import { WebSocketServer } from "ws";
import { handleConnection } from "./ws/connection-handler.js";
import { handleApiRequest } from "./api/routes.js";
import { initRoomManager, shutdownRoomManager } from "./rooms/room-manager.js";
import { SNAPSHOT_DIR } from "./persistence/constants.js";
import { log } from "./lib/logger.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);

const httpServer = createServer(async (req, res) => {
  const handled = await handleApiRequest(req, res);
  if (!handled) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("collab server running");
  }
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", handleConnection);

initRoomManager();

// Graceful shutdown
const shutdown = () => {
  log("server", "shutting down...");
  shutdownRoomManager();
  wss.close();
  httpServer.close(() => {
    log("server", "server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const HOST = process.env.HOST ?? "0.0.0.0";

httpServer.listen(PORT, HOST, () => {
  log("server", `listening on ${HOST}:${PORT}`);
  log("server", `snapshot dir: ${SNAPSHOT_DIR}`);
});
