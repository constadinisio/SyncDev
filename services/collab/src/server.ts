import { createServer } from "http";
import { WebSocketServer } from "ws";
import { handleConnection } from "./ws/connection-handler.js";
import { handleApiRequest } from "./api/routes.js";
import { initRoomManager, shutdownRoomManager } from "./rooms/room-manager.js";
import { loadConfig, type AppConfig } from "./lib/config.js";
import { markReady, markNotReady } from "./lib/readiness.js";
import { log, logError } from "./lib/logger.js";

// Validate configuration before anything else: fail fast on misconfiguration.
let config: AppConfig;
try {
  config = loadConfig();
} catch (err) {
  logError("server", "configuration error, refusing to start", err);
  process.exit(1);
}

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

// Graceful shutdown: stop reporting ready, drain, then exit.
let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  markNotReady();
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

httpServer.listen(config.port, config.host, () => {
  markReady();
  log("server", `listening on ${config.host}:${config.port}`);
  log("server", `snapshot dir: ${config.snapshotDir}`);
  log("server", `env: ${config.nodeEnv}, allowed origins: ${config.allowedOrigins.join(", ")}`);
});
