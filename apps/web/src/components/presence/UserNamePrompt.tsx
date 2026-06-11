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

  const isValid = name.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[10000] animate-fade-in">
      <div
        className="bg-surface-150 border border-surface-300/60 rounded-2xl p-8 min-w-[360px]
        flex flex-col gap-5 shadow-2xl shadow-black/40 animate-scale-in"
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-surface-900 text-lg font-semibold">Welcome to SyncDev</h2>
          <p className="text-surface-500 text-sm">Enter your name to start collaborating.</p>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Your name..."
          autoFocus
          maxLength={30}
          className="bg-surface-200 border border-surface-300/60 rounded-lg px-4 py-3
            text-surface-900 text-sm outline-none font-sans
            focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30
            transition-all duration-150 placeholder:text-surface-500"
        />
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className={`rounded-lg px-5 py-3 text-sm font-semibold transition-all duration-150
            ${
              isValid
                ? "bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-lg shadow-brand-600/25"
                : "bg-surface-300 text-surface-500 cursor-not-allowed"
            }`}
        >
          Join Session
        </button>
      </div>
    </div>
  );
}
