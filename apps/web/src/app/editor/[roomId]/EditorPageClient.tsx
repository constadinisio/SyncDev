"use client";

import { useYjsConnection } from "@/hooks/useYjsConnection";
import { useAwareness } from "@/hooks/useAwareness";
import { CollaborativeEditor } from "@/components/editor/LazyCollaborativeEditor";
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

export default function EditorPage({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const decodedRoomId = decodeURIComponent(roomId);
  const connection = useYjsConnection(decodedRoomId);
  const users = useAwareness(connection?.provider ?? null);

  return (
    <div className="h-screen flex flex-col">
      <div className="px-4 py-2 bg-surface-150 text-surface-800 font-sans text-sm flex justify-between items-center border-b border-surface-300/40">
        <span className="font-medium">{decodedRoomId}</span>
        <div className="flex gap-4 items-center">
          <UserList users={users} />
          {connection && <ConnectionStatus status={connection.status} />}
        </div>
      </div>
      <div className="flex-1">
        {connection ? (
          <CollaborativeEditor
            ytext={connection.ytext}
            provider={connection.provider}
            language={inferLanguage(decodedRoomId)}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-surface-100 text-surface-500 gap-2">
            <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            Connecting...
          </div>
        )}
      </div>
    </div>
  );
}
