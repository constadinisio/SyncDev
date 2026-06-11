import type { IncomingMessage, ServerResponse } from "http";
import { getOrCreateRoom, getRooms } from "../rooms/room-manager.js";
import { log } from "../lib/logger.js";
import { buildCorsHeaders } from "../lib/http.js";

// --- MIME types ---

const MIME_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  ts: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  ico: "image/x-icon",
  txt: "text/plain; charset=utf-8",
  xml: "text/xml; charset=utf-8",
  md: "text/plain; charset=utf-8",
};

function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[ext] ?? "text/plain; charset=utf-8";
}

// --- Auto-reload script injected into HTML ---

const RELOAD_SCRIPT = (projectId: string, port: string) => `
<script>
(function() {
  var es = new EventSource("http://localhost:${port}/preview-events/${encodeURIComponent(projectId)}");
  es.onmessage = function(e) {
    if (e.data === "reload") {
      window.location.reload();
    }
  };
  es.onerror = function() {
    setTimeout(function() { window.location.reload(); }, 2000);
  };
})();
</script>
`;

// --- SSE connections per project ---

const sseClients = new Map<string, Set<ServerResponse>>();

export function notifyPreviewClients(projectId: string): void {
  const clients = sseClients.get(projectId);
  if (!clients || clients.size === 0) return;
  for (const res of clients) {
    try {
      res.write("data: reload\n\n");
    } catch {
      clients.delete(res);
    }
  }
}

// --- Route handlers ---

export function handlePreviewEvents(
  req: IncomingMessage,
  res: ServerResponse,
  projectId: string,
  origin?: string,
): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...buildCorsHeaders(origin),
  });
  res.write("data: connected\n\n");

  if (!sseClients.has(projectId)) {
    sseClients.set(projectId, new Set());
  }
  sseClients.get(projectId)!.add(res);

  req.on("close", () => {
    sseClients.get(projectId)?.delete(res);
    if (sseClients.get(projectId)?.size === 0) {
      sseClients.delete(projectId);
    }
  });

  log("preview", `SSE client connected for project "${projectId}"`);
}

export function handlePreviewRequest(
  _req: IncomingMessage,
  res: ServerResponse,
  projectId: string,
  filePath: string,
  origin?: string,
): void {
  // The room ID format is "projectId::filePath"
  const roomId = `${projectId}::${filePath}`;
  const room = getOrCreateRoom(roomId);
  const content = room.doc.getText("content").toString();

  const mime = getMimeType(filePath);
  const isHtml = mime.startsWith("text/html");
  const port = process.env.PORT ?? "4000";

  if (isHtml) {
    // Inject auto-reload script before </body> or at the end
    const reloadTag = RELOAD_SCRIPT(projectId, port);
    const injected = content.includes("</body>")
      ? content.replace("</body>", `${reloadTag}</body>`)
      : content + reloadTag;

    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": "no-cache",
      ...buildCorsHeaders(origin),
    });
    res.end(injected);
  } else {
    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": "no-cache",
      ...buildCorsHeaders(origin),
    });
    res.end(content);
  }

  log("preview", `served ${filePath} for project "${projectId}"`);
}
