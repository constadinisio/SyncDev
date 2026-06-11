"use client";

import type { AwarenessEntry } from "@/hooks/useAwareness";

interface UserListProps {
  readonly users: readonly AwarenessEntry[];
}

export function UserList({ users }: UserListProps) {
  if (users.length === 0) return null;

  return (
    <div className="flex gap-1.5 items-center">
      {users.map((entry) => (
        <span
          key={entry.clientId}
          className="text-xs px-2.5 py-1 rounded-full font-medium transition-transform duration-100 hover:scale-105"
          style={{
            color: entry.user.color,
            backgroundColor: `${entry.user.color}15`,
            border: `1px solid ${entry.user.color}30`,
          }}
        >
          {entry.user.name}
        </span>
      ))}
    </div>
  );
}
