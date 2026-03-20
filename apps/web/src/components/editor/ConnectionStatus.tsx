"use client";

import type { ConnectionStatus as Status } from "@/hooks/useYjsConnection";

const STATUS_COLORS: Record<Status, string> = {
  connected: "#98c379",
  connecting: "#e5c07b",
  disconnected: "#e06c75",
};

interface ConnectionStatusProps {
  readonly status: Status;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: STATUS_COLORS[status],
          display: "inline-block",
        }}
      />
      <span style={{ fontSize: 12, color: "#808080" }}>{status}</span>
    </span>
  );
}
