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
  error: "#f48771",
  warning: "#e2c08d",
  info: "#75beff",
  hint: "#808080",
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
      style={{
        height,
        flexShrink: 0,
        borderTop: "1px solid #404040",
        backgroundColor: "#1e1e1e",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          height: 4,
          cursor: "row-resize",
          backgroundColor: "transparent",
          flexShrink: 0,
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "4px 12px",
          backgroundColor: "#252526",
          borderBottom: "1px solid #404040",
          flexShrink: 0,
          fontFamily: "system-ui, sans-serif",
          fontSize: 11,
        }}
      >
        <span style={{ color: "#bbbbbb", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Problems
        </span>
        <span
          style={{
            marginLeft: 8,
            color: "#f48771",
            display: "flex",
            alignItems: "center",
            gap: 3,
            fontSize: 11,
          }}
        >
          <span>{SEVERITY_ICONS.error}</span> {errorCount}
        </span>
        <span
          style={{
            marginLeft: 8,
            color: "#e2c08d",
            display: "flex",
            alignItems: "center",
            gap: 3,
            fontSize: 11,
          }}
        >
          <span>{SEVERITY_ICONS.warning}</span> {warningCount}
        </span>

        {filePath && (
          <span style={{ color: "#808080", marginLeft: 12, fontSize: 11 }}>
            {filePath}
          </span>
        )}

        <button
          onClick={onClose}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            color: "#808080",
            cursor: "pointer",
            fontSize: 16,
            padding: "0 4px",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#d4d4d4";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#808080";
          }}
        >
          &#x00D7;
        </button>
      </div>

      {/* Problem list */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {problems.length === 0 && (
          <div
            style={{
              padding: "16px 12px",
              color: "#808080",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
            }}
          >
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
            style={{
              display: "flex",
              alignItems: "flex-start",
              padding: "3px 12px",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
              color: "#d4d4d4",
              cursor: "pointer",
              backgroundColor: hoveredIndex === idx ? "#2a2d2e" : "transparent",
              gap: 8,
            }}
          >
            <span
              style={{
                color: SEVERITY_COLORS[problem.severity],
                flexShrink: 0,
                width: 14,
                textAlign: "center",
              }}
            >
              {SEVERITY_ICONS[problem.severity]}
            </span>
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {problem.message}
            </span>
            {problem.source && (
              <span style={{ color: "#808080", fontSize: 11, flexShrink: 0 }}>
                {problem.source}
              </span>
            )}
            <span style={{ color: "#808080", fontSize: 11, flexShrink: 0 }}>
              [{problem.startLineNumber},{problem.startColumn}]
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
