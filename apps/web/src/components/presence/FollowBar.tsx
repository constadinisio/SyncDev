"use client";

import type { UserPresence } from "@/hooks/useProjectPresence";

interface FollowBarProps {
  readonly following: UserPresence;
  readonly onUnfollow: () => void;
}

export function FollowBar({ following, onUnfollow }: FollowBarProps) {
  return (
    <div
      className="h-7 flex items-center justify-center gap-2 text-xs font-sans font-medium shrink-0 animate-slide-down"
      style={{
        backgroundColor: `${following.color}20`,
        borderBottom: `2px solid ${following.color}`,
        color: following.color,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      Following {following.name}
      {following.activeFile && <span className="text-surface-500">in {following.activeFile}</span>}
      <button
        onClick={onUnfollow}
        className="ml-1 bg-transparent border-none cursor-pointer rounded p-0.5
          transition-colors duration-100 hover:bg-white/10"
        style={{ color: following.color }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
