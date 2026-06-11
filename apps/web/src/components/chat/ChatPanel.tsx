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

  const isValid = inputText.trim().length > 0;

  return (
    <div className="w-[300px] shrink-0 flex flex-col border-l border-surface-300/40 bg-surface-100 font-sans">
      {/* Header */}
      <div className="h-9 bg-surface-150 border-b border-surface-300/40 flex items-center justify-between px-3 shrink-0">
        <span className="text-surface-800 text-[13px] font-medium">Chat</span>
        <button
          onClick={onClose}
          className="bg-transparent border-none text-surface-500 hover:text-surface-800 cursor-pointer
            p-1 rounded transition-colors duration-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-3"
      >
        {messages.length === 0 && (
          <div className="text-surface-500 text-xs text-center mt-6">
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="text-[13px] animate-fade-in">
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <span className="font-semibold" style={{ color: msg.color }}>
                {msg.user}
              </span>
              <span className="text-surface-500 text-[11px]">
                {formatTime(msg.timestamp)}
              </span>
            </div>
            <div className="text-surface-700 break-words leading-relaxed">
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-surface-300/40 p-2 flex gap-1.5 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 bg-surface-200 border border-surface-300/60 rounded-lg px-3 py-2
            text-surface-800 text-[13px] outline-none font-sans
            focus:border-brand-500/50 transition-colors duration-100 placeholder:text-surface-500"
        />
        <button
          onClick={handleSend}
          disabled={!isValid}
          className={`rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-100
            ${isValid
              ? "bg-brand-600 hover:bg-brand-500 text-white cursor-pointer"
              : "bg-surface-300 text-surface-500 cursor-not-allowed"
            }`}
        >
          Send
        </button>
      </div>
    </div>
  );
}
