"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { useYjsConnection } from "@/hooks/useYjsConnection";

interface ChatMessage {
  readonly id: string;
  readonly user: string;
  readonly color: string;
  readonly text: string;
  readonly timestamp: number;
}

function ymapToMessage(ymap: Y.Map<unknown>): ChatMessage {
  return {
    id: (ymap.get("id") as string) ?? "",
    user: (ymap.get("user") as string) ?? "Unknown",
    color: (ymap.get("color") as string) ?? "#808080",
    text: (ymap.get("text") as string) ?? "",
    timestamp: (ymap.get("timestamp") as number) ?? 0,
  };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface ChatPanelProps {
  readonly projectId: string;
  readonly userName: string;
  readonly userColor: string;
  readonly onClose: () => void;
}

export function ChatPanel({
  projectId,
  userName,
  userColor,
  onClose,
}: ChatPanelProps) {
  const chatRoomId = `${projectId}::__chat__`;
  const connection = useYjsConnection(chatRoomId);
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Observe the Y.Array for messages
  useEffect(() => {
    if (!connection) return;

    const yarray = connection.doc.getArray<Y.Map<unknown>>("messages");

    const syncMessages = () => {
      const msgs: ChatMessage[] = [];
      yarray.forEach((ymap) => {
        msgs.push(ymapToMessage(ymap));
      });
      setMessages(msgs);
    };

    yarray.observe(syncMessages);
    syncMessages();

    return () => {
      yarray.unobserve(syncMessages);
    };
  }, [connection]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (text.length === 0 || !connection) return;

    const yarray = connection.doc.getArray<Y.Map<unknown>>("messages");
    const ymap = new Y.Map<unknown>();
    ymap.set("id", `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    ymap.set("user", userName);
    ymap.set("color", userColor);
    ymap.set("text", text);
    ymap.set("timestamp", Date.now());
    yarray.push([ymap]);

    setInputText("");
  }, [inputText, connection, userName, userColor]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid #404040",
        backgroundColor: "#1e1e1e",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 36,
          backgroundColor: "#252526",
          borderBottom: "1px solid #404040",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#d4d4d4", fontSize: 13, fontWeight: 500 }}>
          Chat
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#808080",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: "2px 4px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#d4d4d4";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#808080";
          }}
        >
          x
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "#808080",
              fontSize: 12,
              textAlign: "center",
              marginTop: 24,
            }}
          >
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={{ fontSize: 13 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 6,
                marginBottom: 2,
              }}
            >
              <span style={{ color: msg.color, fontWeight: 600 }}>
                {msg.user}
              </span>
              <span style={{ color: "#6a6a6a", fontSize: 11 }}>
                {formatTime(msg.timestamp)}
              </span>
            </div>
            <div
              style={{
                color: "#cccccc",
                wordBreak: "break-word",
                lineHeight: 1.4,
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div
        style={{
          borderTop: "1px solid #404040",
          padding: 8,
          display: "flex",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          style={{
            flex: 1,
            backgroundColor: "#3c3c3c",
            border: "1px solid #555",
            borderRadius: 4,
            padding: "6px 10px",
            color: "#d4d4d4",
            fontSize: 13,
            outline: "none",
            fontFamily: "system-ui, sans-serif",
          }}
        />
        <button
          onClick={handleSend}
          disabled={inputText.trim().length === 0}
          style={{
            backgroundColor:
              inputText.trim().length > 0 ? "#0e639c" : "#3c3c3c",
            color: inputText.trim().length > 0 ? "#ffffff" : "#808080",
            border: "none",
            borderRadius: 4,
            padding: "6px 12px",
            fontSize: 13,
            cursor: inputText.trim().length > 0 ? "pointer" : "default",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
