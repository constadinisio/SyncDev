"use client";

import { useState, useCallback } from "react";

export interface ProblemEntry {
  readonly severity: "error" | "warning" | "info" | "hint";
  readonly message: string;
  readonly startLineNumber: number;
  readonly startColumn: number;
  readonly source?: string;
}

interface ProblemsPanelProps {
  readonly problems: readonly ProblemEntry[];
  readonly filePath: string | null;
  readonly onProblemClick?: (line: number, column: number) => void;
  readonly onClose: () => void;
  readonly height: number;
  readonly onResize: (height: number) => void;
}

const SEVERITY_ICONS: Record<ProblemEntry["severity"], string> = {
  error: "\u2715",
  warning: "\u26A0",
  info: "\u24D8",
  hint: "\u2139",
};

const SEVERITY_COLORS: Record<ProblemEntry["severity"], string> = {
  error: "text-accent-red",
  warning: "text-accent-yellow",
  info: "text-accent-blue",
  hint: "text-surface-500",
};

export function ProblemsPanel({
  problems,
  filePath,
  onProblemClick,
  onClose,
  height,
  onResize,
}: ProblemsPanelProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const errorCount = problems.filter((p) => p.severity === "error").length;
  const warningCount = problems.filter((p) => p.severity === "warning").length;

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;

      const onMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY;
        const newHeight = Math.max(80, Math.min(500, startHeight + delta));
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
      className="shrink-0 border-t border-surface-300/40 bg-surface-0 flex flex-col"
    >
      <div
        onMouseDown={handleResizeStart}
        className="h-1 cursor-row-resize bg-transparent shrink-0 hover:bg-brand-500/30 transition-colors duration-150"
      />

      <div className="flex items-center px-3 py-1 bg-surface-150 border-b border-surface-300/40 shrink-0 font-sans text-[11px]">
        <span className="text-surface-600 font-semibold uppercase tracking-wider">
          Problems
        </span>
        <span className="ml-2 text-accent-red flex items-center gap-1">
          <span>{SEVERITY_ICONS.error}</span> {errorCount}
        </span>
        <span className="ml-2 text-accent-yellow flex items-center gap-1">
          <span>{SEVERITY_ICONS.warning}</span> {warningCount}
        </span>

        {filePath && (
          <span className="text-surface-500 ml-3 text-[11px]">{filePath}</span>
        )}

        <button
          onClick={onClose}
          className="ml-auto bg-transparent border-none text-surface-500 hover:text-surface-800 cursor-pointer
            p-1 rounded transition-colors duration-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {problems.length === 0 && (
          <div className="px-3 py-4 text-surface-500 text-xs font-sans">
            No problems detected in this file.
          </div>
        )}

        {problems.map((problem, idx) => (
          <div
            key={`${problem.startLineNumber}:${problem.startColumn}:${idx}`}
            onClick={() =>
              onProblemClick?.(problem.startLineNumber, problem.startColumn)
            }
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={`flex items-start px-3 py-1 text-xs font-sans text-surface-800 cursor-pointer gap-2
              transition-colors duration-75 ${hoveredIndex === idx ? "bg-surface-200" : ""}`}
          >
            <span className={`${SEVERITY_COLORS[problem.severity]} shrink-0 w-3.5 text-center`}>
              {SEVERITY_ICONS[problem.severity]}
            </span>
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {problem.message}
            </span>
            {problem.source && (
              <span className="text-surface-500 text-[11px] shrink-0">{problem.source}</span>
            )}
            <span className="text-surface-500 text-[11px] shrink-0">
              [{problem.startLineNumber},{problem.startColumn}]
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
