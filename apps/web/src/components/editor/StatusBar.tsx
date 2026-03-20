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

const STATUS_COLORS: Record<string, string> = {
  connected: "#98c379",
  connecting: "#e5c07b",
  disconnected: "#e06c75",
};

export function StatusBar({
  language,
  cursorPosition,
  connectionStatus = "disconnected",
}: StatusBarProps) {
  return (
    <div
      style={{
        height: 24,
        backgroundColor: "#007acc",
        color: "#ffffff",
        fontSize: 12,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* Left side */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: STATUS_COLORS[connectionStatus] ?? STATUS_COLORS.disconnected,
              display: "inline-block",
            }}
          />
          <span>{connectionStatus}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span>⎇</span>
          <span>main</span>
        </span>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {cursorPosition && (
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        )}
        <span>{language}</span>
        <span>UTF-8</span>
        <span>LF</span>
      </div>
    </div>
  );
}
