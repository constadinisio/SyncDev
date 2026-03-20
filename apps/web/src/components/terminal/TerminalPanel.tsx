"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface TerminalEntry {
  readonly id: number;
  readonly command: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

interface TerminalPanelProps {
  readonly projectId: string;
  readonly height: number;
  readonly onResize: (newHeight: number) => void;
}

import { getApiBase } from "@/lib/api";

let nextEntryId = 1;

export function TerminalPanel({
  projectId,
  height,
  onResize,
}: TerminalPanelProps) {
  const [entries, setEntries] = useState<readonly TerminalEntry[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [entries]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executeCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;

      setRunning(true);
      try {
        const res = await fetch(
          `${getApiBase()}/api/terminal/${encodeURIComponent(projectId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: command.trim() }),
          },
        );

        if (!res.ok) {
          const errorText = await res.text();
          setEntries((prev) => [
            ...prev,
            {
              id: nextEntryId++,
              command,
              stdout: "",
              stderr: `Error: ${res.status} - ${errorText}`,
              exitCode: 1,
            },
          ]);
          return;
        }

        const data = await res.json();
        setEntries((prev) => [
          ...prev,
          {
            id: nextEntryId++,
            command,
            stdout: data.stdout ?? "",
            stderr: data.stderr ?? "",
            exitCode: data.exitCode ?? 0,
          },
        ]);
      } catch (err) {
        setEntries((prev) => [
          ...prev,
          {
            id: nextEntryId++,
            command,
            stdout: "",
            stderr: `Network error: ${err instanceof Error ? err.message : String(err)}`,
            exitCode: 1,
          },
        ]);
      } finally {
        setRunning(false);
        setInput("");
        setHistoryIndex(-1);
        inputRef.current?.focus();
      }
    },
    [projectId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !running) {
        executeCommand(input);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (entries.length > 0) {
          const newIndex =
            historyIndex === -1
              ? entries.length - 1
              : Math.max(0, historyIndex - 1);
          setHistoryIndex(newIndex);
          setInput(entries[newIndex].command);
        }
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex === -1) return;
        const newIndex = historyIndex + 1;
        if (newIndex >= entries.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(newIndex);
          setInput(entries[newIndex].command);
        }
      }
    },
    [input, running, executeCommand, entries, historyIndex],
  );

  const handleClear = useCallback(() => {
    setEntries([]);
  }, []);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;

      const onMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY;
        const newHeight = Math.max(100, Math.min(600, startHeight + delta));
        onResize(newHeight);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [height, onResize],
  );

  return (
    <div
      style={{
        height,
        backgroundColor: "#1e1e1e",
        borderTop: "1px solid #404040",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          height: 4,
          cursor: "row-resize",
          backgroundColor: "transparent",
          flexShrink: 0,
        }}
      />

      {/* Terminal header */}
      <div
        style={{
          padding: "4px 12px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#bbbbbb",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #404040",
          flexShrink: 0,
        }}
      >
        <span>Terminal</span>
        <button
          onClick={handleClear}
          title="Clear Terminal"
          style={{
            background: "none",
            border: "none",
            color: "#cccccc",
            cursor: "pointer",
            fontSize: 12,
            padding: "0 4px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Clear
        </button>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "4px 12px",
          fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        {entries.map((entry) => (
          <div key={entry.id} style={{ marginBottom: 8 }}>
            {/* Command */}
            <div style={{ color: "#569cd6" }}>
              <span style={{ color: "#6a9955" }}>$ </span>
              {entry.command}
            </div>
            {/* Stdout */}
            {entry.stdout && (
              <div style={{ color: "#d4d4d4", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {entry.stdout}
              </div>
            )}
            {/* Stderr */}
            {entry.stderr && (
              <div style={{ color: "#f44747", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {entry.stderr}
              </div>
            )}
            {/* Exit code indicator */}
            {entry.exitCode !== 0 && (
              <div style={{ color: "#808080", fontSize: 11 }}>
                exit code: {entry.exitCode}
              </div>
            )}
          </div>
        ))}

        {running && (
          <div style={{ color: "#569cd6", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ animation: "pulse 1.5s infinite", display: "inline-block" }}>
              ●
            </span>
            Running... (long commands like npm install may take a few minutes)
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
          </div>
        )}
      </div>

      {/* Input line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "4px 12px",
          borderTop: "1px solid #333333",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: "#6a9955",
            fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
            fontSize: 13,
            marginRight: 6,
          }}
        >
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          placeholder={running ? "Running..." : "Type a command..."}
          style={{
            flex: 1,
            backgroundColor: "transparent",
            color: "#d4d4d4",
            border: "none",
            outline: "none",
            fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
            fontSize: 13,
          }}
        />
      </div>
    </div>
  );
}
