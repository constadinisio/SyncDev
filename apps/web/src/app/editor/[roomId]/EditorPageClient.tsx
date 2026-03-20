"use client";

import { useYjsConnection } from "@/hooks/useYjsConnection";
import { useAwareness } from "@/hooks/useAwareness";
import { CollaborativeEditor } from "@/components/editor/CollaborativeEditor";
import { ConnectionStatus } from "@/components/editor/ConnectionStatus";
import { UserList } from "@/components/presence/UserList";

function inferLanguage(roomId: string): string {
  const ext = roomId.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    css: "css",
    html: "html",
    json: "json",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
  };
  return languageMap[ext ?? ""] ?? "plaintext";
}

export default function EditorPage({
  params,
}: {
  params: { roomId: string };
}) {
  const { roomId } = params;
  const decodedRoomId = decodeURIComponent(roomId);
  const connection = useYjsConnection(decodedRoomId);
  const users = useAwareness(connection?.provider ?? null);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "8px 16px",
          backgroundColor: "#252526",
          color: "#d4d4d4",
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #404040",
        }}
      >
        <span style={{ fontWeight: 500 }}>{decodedRoomId}</span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <UserList users={users} />
          {connection && <ConnectionStatus status={connection.status} />}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {connection ? (
          <CollaborativeEditor
            ytext={connection.ytext}
            provider={connection.provider}
            language={inferLanguage(decodedRoomId)}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              backgroundColor: "#1e1e1e",
              color: "#808080",
            }}
          >
            Connecting...
          </div>
        )}
      </div>
    </div>
  );
}
