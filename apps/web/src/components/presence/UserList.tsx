"use client";

import type { AwarenessEntry } from "@/hooks/useAwareness";

interface UserListProps {
  readonly users: readonly AwarenessEntry[];
}

export function UserList({ users }: UserListProps) {
  if (users.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {users.map((entry) => (
        <span
          key={entry.clientId}
          style={{
            fontSize: 12,
            color: entry.user.color,
            padding: "2px 8px",
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 4,
            border: `1px solid ${entry.user.color}40`,
          }}
        >
          {entry.user.name}
        </span>
      ))}
    </div>
  );
}
