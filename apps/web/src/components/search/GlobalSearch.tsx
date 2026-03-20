"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface SearchMatch {
  readonly filePath: string;
  readonly line: number;
  readonly content: string;
  readonly matchStart: number;
  readonly matchEnd: number;
}

interface SearchResultGroup {
  readonly filePath: string;
  readonly matches: readonly SearchMatch[];
}

interface GlobalSearchProps {
  readonly projectId: string;
  readonly onResultSelect: (filePath: string, line: number) => void;
  readonly onBack: () => void;
}

import { getApiBase } from "@/lib/api";

function groupByFile(matches: readonly SearchMatch[]): readonly SearchResultGroup[] {
  const groups = new Map<string, SearchMatch[]>();
  for (const match of matches) {
    const existing = groups.get(match.filePath);
    if (existing) {
      existing.push(match);
    } else {
      groups.set(match.filePath, [match]);
    }
  }
  return Array.from(groups.entries()).map(([filePath, fileMatches]) => ({
    filePath,
    matches: fileMatches,
  }));
}

export function GlobalSearch({
  projectId,
  onResultSelect,
  onBack,
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly SearchResultGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [collapsedFiles, setCollapsedFiles] = useState<ReadonlySet<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setSearchedQuery("");
        return;
      }

      setSearching(true);
      try {
        const url = `${getApiBase()}/api/search/${encodeURIComponent(projectId)}?q=${encodeURIComponent(searchQuery.trim())}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.error("Search failed:", res.status);
          setResults([]);
          return;
        }
        const data = await res.json();
        const matches = (data.matches ?? []) as SearchMatch[];
        setResults(groupByFile(matches));
        setSearchedQuery(searchQuery.trim());
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [projectId],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    },
    [performSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        performSearch(query);
      }
      if (e.key === "Escape") {
        onBack();
      }
    },
    [query, performSearch, onBack],
  );

  const toggleFileCollapse = useCallback((filePath: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  const totalMatches = results.reduce((sum, g) => sum + g.matches.length, 0);

  return (
    <div
      style={{
        height: "100%",
        backgroundColor: "#252526",
        borderRight: "1px solid #404040",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#bbbbbb",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Search</span>
        <button
          onClick={onBack}
          title="Back to Explorer"
          style={{
            background: "none",
            border: "none",
            color: "#cccccc",
            cursor: "pointer",
            fontSize: 14,
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ←
        </button>
      </div>

      {/* Search input */}
      <div style={{ padding: "4px 8px 8px" }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search in files..."
          style={{
            width: "100%",
            padding: "4px 8px",
            fontSize: 13,
            fontFamily: "system-ui, sans-serif",
            backgroundColor: "#3c3c3c",
            color: "#d4d4d4",
            border: "1px solid #555555",
            borderRadius: 3,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Status line */}
      {searchedQuery && (
        <div
          style={{
            padding: "2px 12px 6px",
            fontSize: 11,
            color: "#808080",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {totalMatches} result{totalMatches !== 1 ? "s" : ""} in{" "}
          {results.length} file{results.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Results */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {searching && (
          <div
            style={{
              padding: "16px 12px",
              color: "#808080",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Searching...
          </div>
        )}

        {!searching && searchedQuery && results.length === 0 && (
          <div
            style={{
              padding: "16px 12px",
              color: "#808080",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            No results found for &quot;{searchedQuery}&quot;
          </div>
        )}

        {results.map((group) => {
          const isCollapsed = collapsedFiles.has(group.filePath);
          const fileName = group.filePath.split("/").pop() ?? group.filePath;
          return (
            <div key={group.filePath}>
              {/* File header */}
              <div
                onClick={() => toggleFileCollapse(group.filePath)}
                style={{
                  padding: "4px 8px",
                  fontSize: 12,
                  fontFamily: "system-ui, sans-serif",
                  color: "#d4d4d4",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: "#2d2d2d",
                  userSelect: "none",
                }}
              >
                <span style={{ fontSize: 10, width: 12, textAlign: "center" }}>
                  {isCollapsed ? "▸" : "▾"}
                </span>
                <span style={{ fontWeight: 600 }}>{fileName}</span>
                <span style={{ color: "#808080", marginLeft: 4 }}>
                  {group.filePath}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    color: "#808080",
                    fontSize: 11,
                    backgroundColor: "#404040",
                    padding: "0 6px",
                    borderRadius: 8,
                  }}
                >
                  {group.matches.length}
                </span>
              </div>

              {/* Matches */}
              {!isCollapsed &&
                group.matches.map((match, idx) => (
                  <div
                    key={`${match.filePath}:${match.line}:${idx}`}
                    onClick={() => onResultSelect(match.filePath, match.line)}
                    style={{
                      padding: "2px 8px 2px 28px",
                      fontSize: 12,
                      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
                      color: "#d4d4d4",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#2a2d2e";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <span style={{ color: "#808080", marginRight: 8 }}>
                      {match.line}
                    </span>
                    <span>
                      {match.content.substring(0, match.matchStart)}
                    </span>
                    <span
                      style={{
                        backgroundColor: "#613214",
                        color: "#e8b054",
                        borderRadius: 2,
                      }}
                    >
                      {match.content.substring(match.matchStart, match.matchEnd)}
                    </span>
                    <span>
                      {match.content.substring(match.matchEnd)}
                    </span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
