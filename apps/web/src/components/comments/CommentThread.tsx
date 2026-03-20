"use client";

import { useState, useCallback } from "react";

export interface CommentData {
  readonly id: string;
  readonly line: number;
  readonly user: string;
  readonly color: string;
  readonly text: string;
  readonly timestamp: number;
  readonly resolved: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface CommentThreadProps {
  readonly line: number;
  readonly comments: readonly CommentData[];
  readonly userName: string;
  readonly userColor: string;
  readonly onAddComment: (line: number, text: string) => void;
  readonly onResolve: (commentId: string) => void;
  readonly onClose: () => void;
}

export function CommentThread({
  line,
  comments,
  userName,
  userColor,
  onAddComment,
  onResolve,
  onClose,
}: CommentThreadProps) {
  const [replyText, setReplyText] = useState("");

  const handleSubmit = useCallback(() => {
    const text = replyText.trim();
    if (text.length === 0) return;
    onAddComment(line, text);
    setReplyText("");
  }, [replyText, line, onAddComment]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSubmit, onClose],
  );

  const activeComments = comments.filter((c) => !c.resolved);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 320,
        maxHeight: 400,
        backgroundColor: "#252526",
        border: "1px solid #404040",
        borderRadius: 4,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid #404040",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#d4d4d4", fontSize: 13, fontWeight: 500 }}>
          Line {line} Comments
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#808080",
            cursor: "pointer",
            fontSize: 16,
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

      {/* Comments list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {activeComments.length === 0 && (
          <div style={{ color: "#808080", fontSize: 12, textAlign: "center" }}>
            No comments on this line yet.
          </div>
        )}
        {activeComments.map((comment) => (
          <div
            key={comment.id}
            style={{
              backgroundColor: "#1e1e1e",
              borderRadius: 4,
              padding: 8,
              fontSize: 13,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ color: comment.color, fontWeight: 600 }}>
                  {comment.user}
                </span>
                <span style={{ color: "#6a6a6a", fontSize: 11 }}>
                  {formatTime(comment.timestamp)}
                </span>
              </div>
              <button
                onClick={() => onResolve(comment.id)}
                title="Resolve"
                style={{
                  background: "none",
                  border: "none",
                  color: "#808080",
                  cursor: "pointer",
                  fontSize: 11,
                  padding: "2px 6px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#4ec9b0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#808080";
                }}
              >
                Resolve
              </button>
            </div>
            <div
              style={{
                color: "#cccccc",
                wordBreak: "break-word",
                lineHeight: 1.4,
              }}
            >
              {comment.text}
            </div>
          </div>
        ))}
      </div>

      {/* Reply input */}
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
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          autoFocus
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
          onClick={handleSubmit}
          disabled={replyText.trim().length === 0}
          style={{
            backgroundColor:
              replyText.trim().length > 0 ? "#0e639c" : "#3c3c3c",
            color: replyText.trim().length > 0 ? "#ffffff" : "#808080",
            border: "none",
            borderRadius: 4,
            padding: "6px 10px",
            fontSize: 13,
            cursor: replyText.trim().length > 0 ? "pointer" : "default",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
