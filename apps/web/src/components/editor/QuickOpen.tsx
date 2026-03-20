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
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 2000,
        display: "flex",
        justifyContent: "center",
        paddingTop: 80,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 500,
          maxHeight: 400,
          backgroundColor: "#252526",
          border: "1px solid #404040",
          borderRadius: 6,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search files by name..."
          style={{
            padding: "10px 14px",
            backgroundColor: "#3c3c3c",
            border: "none",
            borderBottom: "1px solid #404040",
            color: "#d4d4d4",
            fontSize: 14,
            fontFamily: "system-ui, sans-serif",
            outline: "none",
          }}
        />
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "12px 14px",
                color: "#808080",
                fontSize: 13,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              No files found
            </div>
          ) : (
            filtered.map((path, index) => (
              <div
                key={path}
                onClick={() => handleSelect(path)}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontFamily: "system-ui, sans-serif",
                  color: index === selectedIndex ? "#ffffff" : "#cccccc",
                  backgroundColor: index === selectedIndex ? "#094771" : "transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                onMouseEnter={(e) => {
                  setSelectedIndex(index);
                }}
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
