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
  const isValid = replyText.trim().length > 0;

  return (
    <div
      className="absolute top-0 right-0 w-80 max-h-[400px] bg-surface-150 border border-surface-300/60
      rounded-xl shadow-xl shadow-black/30 flex flex-col font-sans z-[1000] overflow-hidden animate-scale-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-300/40 shrink-0">
        <span className="text-surface-800 text-[13px] font-medium">Line {line} Comments</span>
        <button
          onClick={onClose}
          className="bg-transparent border-none text-surface-500 hover:text-surface-800 cursor-pointer
            p-1 rounded transition-colors duration-100"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {activeComments.length === 0 && (
          <div className="text-surface-500 text-xs text-center py-2">
            No comments on this line yet.
          </div>
        )}
        {activeComments.map((comment) => (
          <div
            key={comment.id}
            className="bg-surface-100 rounded-lg p-2.5 text-[13px] animate-fade-in"
          >
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold" style={{ color: comment.color }}>
                  {comment.user}
                </span>
                <span className="text-surface-500 text-[11px]">
                  {formatTime(comment.timestamp)}
                </span>
              </div>
              <button
                onClick={() => onResolve(comment.id)}
                title="Resolve"
                className="bg-transparent border-none text-surface-500 hover:text-accent-green cursor-pointer
                  text-[11px] px-1.5 py-0.5 rounded transition-colors duration-100"
              >
                Resolve
              </button>
            </div>
            <div className="text-surface-700 break-words leading-relaxed">{comment.text}</div>
          </div>
        ))}
      </div>

      {/* Reply input */}
      <div className="border-t border-surface-300/40 p-2 flex gap-1.5 shrink-0">
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          autoFocus
          className="flex-1 bg-surface-200 border border-surface-300/60 rounded-lg px-3 py-1.5
            text-surface-800 text-[13px] outline-none font-sans
            focus:border-brand-500/50 transition-colors duration-100 placeholder:text-surface-500"
        />
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-100
            ${
              isValid
                ? "bg-brand-600 hover:bg-brand-500 text-white cursor-pointer"
                : "bg-surface-300 text-surface-500 cursor-not-allowed"
            }`}
        >
          Add
        </button>
      </div>
    </div>
  );
}
