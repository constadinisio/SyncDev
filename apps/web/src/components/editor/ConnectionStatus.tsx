"use client";

import type { ConnectionStatus as Status } from "@/hooks/useYjsConnection";

const STATUS_CONFIG: Record<Status, { color: string; label: string }> = {
  connected: { color: "bg-accent-green", label: "Connected" },
  connecting: { color: "bg-accent-yellow animate-pulse-glow", label: "Connecting" },
  disconnected: { color: "bg-accent-red", label: "Disconnected" },
};

interface ConnectionStatusProps {
  readonly status: Status;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-surface-600">{config.label}</span>
    </span>
  );
}
