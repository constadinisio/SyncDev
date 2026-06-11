"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { TreeNode } from "@/lib/api";

interface QuickOpenProps {
  readonly tree: readonly TreeNode[];
  readonly onSelect: (path: string) => void;
  readonly onClose: () => void;
}

function flattenTree(nodes: readonly TreeNode[], prefix: string): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "file") {
      result.push(path);
    } else {
      result.push(...flattenTree(node.children, path));
    }
  }
  return result;
}

export function QuickOpen({ tree, onSelect, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allFiles = useMemo(() => flattenTree(tree, ""), [tree]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allFiles;
    const lower = query.toLowerCase();
    return allFiles.filter((f) => f.toLowerCase().includes(lower));
  }, [allFiles, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (path: string) => {
      onSelect(path);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered.length > 0) {
          handleSelect(filtered[selectedIndex] ?? filtered[0]);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
    },
    [filtered, selectedIndex, handleSelect, onClose],
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex justify-center pt-20 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-h-[420px] bg-surface-150 border border-surface-300/60 rounded-xl
          shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-slide-down"
      >
        <div className="relative">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name..."
            className="w-full py-3.5 pl-11 pr-4 bg-transparent border-b border-surface-300/60
              text-surface-900 text-sm font-sans outline-none placeholder:text-surface-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-surface-500 text-sm font-sans text-center">
              No files found
            </div>
          ) : (
            filtered.map((path, index) => (
              <div
                key={path}
                onClick={() => handleSelect(path)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`px-4 py-2 text-[13px] font-sans cursor-pointer whitespace-nowrap
                  overflow-hidden text-ellipsis transition-colors duration-75
                  ${index === selectedIndex
                    ? "bg-brand-600/20 text-brand-300"
                    : "text-surface-800 hover:bg-surface-200"
                  }`}
              >
                {path}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
