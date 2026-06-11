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

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  return (
    <div className="w-[280px] shrink-0 flex flex-col border-l border-surface-300/40 bg-surface-100 font-sans">
      {/* Header */}
      <div className="h-9 bg-surface-150 border-b border-surface-300/40 flex items-center justify-between px-3 shrink-0">
        <span className="text-surface-800 text-[13px] font-medium">History</span>
        <button
          onClick={onClose}
          className="bg-transparent border-none text-surface-500 hover:text-surface-800 cursor-pointer
            p-1 rounded transition-colors duration-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {!filePath && (
          <div className="text-surface-500 text-xs text-center mt-6">
            Open a file to see its history.
          </div>
        )}

        {filePath && loading && entries.length === 0 && (
          <div className="text-surface-500 text-xs text-center mt-6 flex items-center justify-center gap-2">
            <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        )}

        {filePath && error && (
          <div className="text-accent-red text-xs text-center mt-6">
            {error}
          </div>
        )}

        {filePath && !loading && !error && entries.length === 0 && (
          <div className="text-surface-500 text-xs text-center mt-6">
            No edits recorded yet.
          </div>
        )}

        {entries.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-surface-500 text-[11px] mb-1 px-1">
              {filePath}
            </div>
            {entries.map((entry, idx) => (
              <div
                key={`${entry.timestamp}-${idx}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-surface-200
                  transition-colors duration-75"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-surface-800">
                    {entry.user} edited
                  </div>
                  <div className="text-surface-500 text-[11px]">
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
