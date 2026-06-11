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

export function GlobalSearch({ projectId, onResultSelect, onBack }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly SearchResultGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [collapsedFiles, setCollapsedFiles] = useState<ReadonlySet<string>>(new Set());
  const [regexMode, setRegexMode] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [replacing, setReplacing] = useState(false);
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
        const regexParam = regexMode ? "&regex=1" : "";
        const url = `${getApiBase()}/api/search/${encodeURIComponent(projectId)}?q=${encodeURIComponent(searchQuery.trim())}${regexParam}`;
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

  const handleReplaceAll = useCallback(async () => {
    // `replaceQuery` may legitimately be empty (replace-with-nothing), so the
    // only meaningful guard is requiring a search query. (Previously this read
    // `!replaceQuery === undefined`, which was always false and never fired.)
    if (!searchedQuery) return;
    setReplacing(true);
    try {
      const regexParam = regexMode ? "&regex=1" : "";
      const url = `${getApiBase()}/api/replace/${encodeURIComponent(projectId)}?q=${encodeURIComponent(searchedQuery)}&replace=${encodeURIComponent(replaceQuery)}${regexParam}`;
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        // Re-search to update results
        performSearch(searchedQuery);
      }
    } catch (err) {
      console.error("Replace failed:", err);
    } finally {
      setReplacing(false);
    }
  }, [searchedQuery, replaceQuery, regexMode, projectId, performSearch]);

  const totalMatches = results.reduce((sum, g) => sum + g.matches.length, 0);

  return (
    <div className="h-full bg-surface-150 border-r border-surface-300/40 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-surface-600
        font-sans flex justify-between items-center"
      >
        <span>Search</span>
        <button
          onClick={onBack}
          title="Back to Explorer"
          className="bg-transparent border-none text-surface-500 hover:text-surface-800 cursor-pointer
            p-1 rounded transition-colors duration-100"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
      </div>

      {/* Search input */}
      <div className="px-2 pb-2">
        <div className="relative flex items-center gap-1">
          <div className="relative flex-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={regexMode ? "Regex pattern..." : "Search in files..."}
              className="w-full py-1.5 pl-8 pr-2 text-[13px] font-sans bg-surface-200 text-surface-800
                border border-surface-300/60 rounded-lg outline-none
                focus:border-brand-500/50 transition-colors duration-100 placeholder:text-surface-500"
            />
          </div>
          <button
            onClick={() => setRegexMode((p) => !p)}
            title="Toggle Regex"
            className={`px-1.5 py-1 text-[11px] font-mono font-bold rounded-md border cursor-pointer
              transition-all duration-100 shrink-0
              ${
                regexMode
                  ? "bg-brand-600 text-white border-brand-500"
                  : "bg-surface-200 text-surface-500 border-surface-300/60 hover:text-surface-700"
              }`}
          >
            .*
          </button>
        </div>
      </div>

      {/* Replace input */}
      <div className="px-2 pb-2 flex items-center gap-1">
        <button
          onClick={() => setShowReplace((p) => !p)}
          title="Toggle Replace"
          className={`p-1 rounded-md border cursor-pointer transition-all duration-100 shrink-0
            ${
              showReplace
                ? "bg-brand-600/20 text-brand-400 border-brand-500/30"
                : "bg-transparent text-surface-500 border-transparent hover:text-surface-700"
            }`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${showReplace ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {showReplace && (
          <div className="flex-1 flex items-center gap-1">
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace with..."
              className="flex-1 py-1.5 px-2 text-[13px] font-sans bg-surface-200 text-surface-800
                border border-surface-300/60 rounded-lg outline-none
                focus:border-brand-500/50 transition-colors duration-100 placeholder:text-surface-500"
            />
            <button
              onClick={handleReplaceAll}
              disabled={replacing || !searchedQuery}
              title="Replace All"
              className={`px-2 py-1 text-[11px] font-medium rounded-md border cursor-pointer shrink-0
                transition-all duration-100
                ${
                  replacing || !searchedQuery
                    ? "bg-surface-300 text-surface-500 border-surface-300/60 cursor-not-allowed"
                    : "bg-accent-orange/20 text-accent-orange border-accent-orange/30 hover:bg-accent-orange/30"
                }`}
            >
              {replacing ? "..." : "All"}
            </button>
          </div>
        )}
      </div>

      {/* Status line */}
      {searchedQuery && (
        <div className="px-3 pb-1.5 text-[11px] text-surface-500 font-sans">
          {totalMatches} result{totalMatches !== 1 ? "s" : ""} in {results.length} file
          {results.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {searching && (
          <div className="px-3 py-4 text-surface-500 text-xs font-sans flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            Searching...
          </div>
        )}

        {!searching && searchedQuery && results.length === 0 && (
          <div className="px-3 py-4 text-surface-500 text-xs font-sans">
            No results found for &quot;{searchedQuery}&quot;
          </div>
        )}

        {results.map((group) => {
          const isCollapsed = collapsedFiles.has(group.filePath);
          const fileName = group.filePath.split("/").pop() ?? group.filePath;
          return (
            <div key={group.filePath}>
              <div
                onClick={() => toggleFileCollapse(group.filePath)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-sans text-surface-800
                  cursor-pointer bg-surface-200 select-none hover:bg-surface-300/50 transition-colors duration-75"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-surface-500 transition-transform duration-100 ${isCollapsed ? "-rotate-90" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span className="font-semibold">{fileName}</span>
                <span className="text-surface-500 ml-1">{group.filePath}</span>
                <span className="ml-auto text-surface-500 text-[11px] bg-surface-300 px-1.5 rounded-full">
                  {group.matches.length}
                </span>
              </div>

              {!isCollapsed &&
                group.matches.map((match, idx) => (
                  <div
                    key={`${match.filePath}:${match.line}:${idx}`}
                    onClick={() => onResultSelect(match.filePath, match.line)}
                    className="py-0.5 pr-2 pl-7 text-xs font-mono text-surface-800 cursor-pointer
                      whitespace-nowrap overflow-hidden text-ellipsis
                      hover:bg-surface-200 transition-colors duration-75"
                  >
                    <span className="text-surface-500 mr-2">{match.line}</span>
                    <span>{match.content.substring(0, match.matchStart)}</span>
                    <span className="bg-amber-500/20 text-amber-400 rounded-sm">
                      {match.content.substring(match.matchStart, match.matchEnd)}
                    </span>
                    <span>{match.content.substring(match.matchEnd)}</span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
