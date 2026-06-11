"use client";

interface CursorPosition {
  readonly line: number;
  readonly column: number;
}

interface StatusBarProps {
  readonly language: string;
  readonly cursorPosition: CursorPosition | null;
  readonly connectionStatus?: "connected" | "connecting" | "disconnected";
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  connected: { color: "bg-accent-green", label: "Connected" },
  connecting: { color: "bg-accent-yellow animate-pulse-glow", label: "Connecting" },
  disconnected: { color: "bg-accent-red", label: "Disconnected" },
};

export function StatusBar({
  language,
  cursorPosition,
  connectionStatus = "disconnected",
}: StatusBarProps) {
  const status = STATUS_CONFIG[connectionStatus] ?? STATUS_CONFIG.disconnected;

  return (
    <div
      className="h-6 bg-gradient-to-r from-brand-700 to-brand-600 text-white text-xs font-sans
      flex items-center justify-between px-3 shrink-0 select-none"
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${status.color}`} />
          <span className="opacity-90">{status.label}</span>
        </span>
        <span className="flex items-center gap-1.5 opacity-80">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          <span>main</span>
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4 opacity-90">
        {cursorPosition && (
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        )}
        <span className="font-medium">{language}</span>
        <span>UTF-8</span>
        <span>LF</span>
      </div>
    </div>
  );
}
