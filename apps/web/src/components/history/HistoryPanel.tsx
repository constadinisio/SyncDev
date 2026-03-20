"use client";

import { useState, useEffect, useCallback } from "react";

import { getApiBase } from "@/lib/api";

interface HistoryEntry {
  readonly user: string;
  readonly timestamp: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return "Today";
  }
  return d.toLocaleDateString();
}

interface HistoryPanelProps {
  readonly projectId: string;
  readonly filePath: string | null;
  readonly onClose: () => void;
}

export function HistoryPanel({
  projectId,
  filePath,
  onClose,
}: HistoryPanelProps) {
  const [entries, setEntries] = useState<readonly HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!filePath) return;
    setLoading(true);
    setError(null);
    try {
      const encodedProject = encodeURIComponent(projectId);
      const encodedFile = encodeURIComponent(filePath);
      const res = await fetch(
        `${getApiBase()}/api/history/${encodedProject}/${encodedFile}`,
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch history: ${res.status}`);
      }
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [projectId, filePath]);

  // Poll every 5 seconds while the panel is open
  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid #404040",
        backgroundColor: "#1e1e1e",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 36,
          backgroundColor: "#252526",
          borderBottom: "1px solid #404040",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#d4d4d4", fontSize: 13, fontWeight: 500 }}>
          History
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#808080",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: "2px 4px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#d4d4d4";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#808080";
          }}
        >
          x
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 8,
        }}
      >
        {!filePath && (
          <div
            style={{
              color: "#808080",
              fontSize: 12,
              textAlign: "center",
              marginTop: 24,
            }}
          >
            Open a file to see its history.
          </div>
        )}

        {filePath && loading && entries.length === 0 && (
          <div
            style={{
              color: "#808080",
              fontSize: 12,
              textAlign: "center",
              marginTop: 24,
            }}
          >
            Loading...
          </div>
        )}

        {filePath && error && (
          <div
            style={{
              color: "#f14c4c",
              fontSize: 12,
              textAlign: "center",
              marginTop: 24,
            }}
          >
            {error}
          </div>
        )}

        {filePath && !loading && !error && entries.length === 0 && (
          <div
            style={{
              color: "#808080",
              fontSize: 12,
              textAlign: "center",
              marginTop: 24,
            }}
          >
            No edits recorded yet.
          </div>
        )}

        {entries.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                color: "#808080",
                fontSize: 11,
                marginBottom: 4,
                padding: "0 4px",
              }}
            >
              {filePath}
            </div>
            {entries.map((entry, idx) => (
              <div
                key={`${entry.timestamp}-${idx}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 8px",
                  borderRadius: 3,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "#0e639c",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#d4d4d4" }}>
                    {entry.user} edited
                  </div>
                  <div style={{ color: "#6a6a6a", fontSize: 11 }}>
                    {formatDate(entry.timestamp)} {formatTime(entry.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
