"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "collab-username";

export function getStoredUserName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredUserName(name: string): void {
  localStorage.setItem(STORAGE_KEY, name);
}

interface UserNamePromptProps {
  readonly onSubmit: (name: string) => void;
}

export function UserNamePrompt({ onSubmit }: UserNamePromptProps) {
  const [name, setName] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setStoredUserName(trimmed);
    onSubmit(trimmed);
  }, [name, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#252526",
          border: "1px solid #404040",
          borderRadius: 6,
          padding: 24,
          minWidth: 320,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ color: "#d4d4d4", fontSize: 16, fontWeight: 600 }}>
          Enter your name
        </div>
        <div style={{ color: "#808080", fontSize: 13 }}>
          This name will be visible to other collaborators.
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Your name..."
          autoFocus
          maxLength={30}
          style={{
            backgroundColor: "#3c3c3c",
            border: "1px solid #555",
            borderRadius: 4,
            padding: "8px 12px",
            color: "#d4d4d4",
            fontSize: 14,
            outline: "none",
            fontFamily: "system-ui, sans-serif",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={name.trim().length === 0}
          style={{
            backgroundColor: name.trim().length > 0 ? "#0e639c" : "#3c3c3c",
            color: name.trim().length > 0 ? "#ffffff" : "#808080",
            border: "none",
            borderRadius: 4,
            padding: "8px 16px",
            fontSize: 14,
            cursor: name.trim().length > 0 ? "pointer" : "default",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Join
        </button>
      </div>
    </div>
  );
}
