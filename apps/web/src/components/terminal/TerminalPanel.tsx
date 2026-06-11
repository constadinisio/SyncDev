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
  readonly onCommandComplete?: () => void;
}

import { getApiBase } from "@/lib/api";

let nextEntryId = 1;

export function TerminalPanel({
  projectId,
  height,
  onResize,
  onCommandComplete,
}: TerminalPanelProps) {
  const [entries, setEntries] = useState<readonly TerminalEntry[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [entries]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executeCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;

      setRunning(true);
      try {
        const res = await fetch(`${getApiBase()}/api/terminal/${encodeURIComponent(projectId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: command.trim() }),
        });

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
        // Notify parent so it can refresh the file tree
        onCommandComplete?.();
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
          const newIndex = historyIndex === -1 ? entries.length - 1 : Math.max(0, historyIndex - 1);
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
      style={{ height }}
      className="bg-surface-0 border-t border-surface-300/40 flex flex-col shrink-0"
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="h-1 cursor-row-resize bg-transparent shrink-0 hover:bg-brand-500/30 transition-colors duration-150"
      />

      {/* Terminal header */}
      <div
        className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-surface-600
        font-sans flex justify-between items-center border-b border-surface-300/40 shrink-0"
      >
        <span>Terminal</span>
        <button
          onClick={handleClear}
          title="Clear Terminal"
          className="bg-transparent border-none text-surface-500 hover:text-surface-800 cursor-pointer
            text-xs font-sans font-normal normal-case tracking-normal transition-colors duration-100"
        >
          Clear
        </button>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-1 font-mono text-[13px] leading-relaxed"
      >
        {entries.map((entry) => (
          <div key={entry.id} className="mb-2">
            <div className="text-brand-400">
              <span className="text-accent-green">$ </span>
              {entry.command}
            </div>
            {entry.stdout && (
              <div className="text-surface-800 whitespace-pre-wrap break-all">{entry.stdout}</div>
            )}
            {entry.stderr && (
              <div className="text-accent-red whitespace-pre-wrap break-all">{entry.stderr}</div>
            )}
            {entry.exitCode !== 0 && (
              <div className="text-surface-500 text-[11px]">exit code: {entry.exitCode}</div>
            )}
          </div>
        ))}

        {running && (
          <div className="text-brand-400 flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            Running... (long commands may take a few minutes)
          </div>
        )}
      </div>

      {/* Input line */}
      <div className="flex items-center px-3 py-1 border-t border-surface-300/30 shrink-0">
        <span className="text-accent-green font-mono text-[13px] mr-1.5">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          placeholder={running ? "Running..." : "Type a command..."}
          className="flex-1 bg-transparent text-surface-800 border-none outline-none font-mono text-[13px]
            placeholder:text-surface-500"
        />
      </div>
    </div>
  );
}
