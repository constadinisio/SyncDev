"use client";

import { useCallback } from "react";

interface TabBarProps {
  readonly openTabs: readonly string[];
  readonly activeTab: string | null;
  readonly onTabSelect: (path: string) => void;
  readonly onTabClose: (path: string) => void;
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function TabBar({
  openTabs,
  activeTab,
  onTabSelect,
  onTabClose,
}: TabBarProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, path: string) => {
      // Middle-click closes tab
      if (e.button === 1) {
        e.preventDefault();
        onTabClose(path);
      }
    },
    [onTabClose],
  );

  if (openTabs.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        backgroundColor: "#252526",
        borderBottom: "1px solid #404040",
        overflowX: "auto",
        overflowY: "hidden",
        flexShrink: 0,
        height: 35,
      }}
    >
      {openTabs.map((path) => {
        const isActive = path === activeTab;
        return (
          <div
            key={path}
            onClick={() => onTabSelect(path)}
            onMouseDown={(e) => handleMouseDown(e, path)}
            title={path}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 12px",
              height: "100%",
              backgroundColor: isActive ? "#1e1e1e" : "#2d2d2d",
              color: isActive ? "#ffffff" : "#808080",
              borderTop: isActive ? "2px solid #007acc" : "2px solid transparent",
              borderRight: "1px solid #252526",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "system-ui, sans-serif",
              whiteSpace: "nowrap",
              userSelect: "none",
              flexShrink: 0,
            }}
          >
            <span>{getFileName(path)}</span>
            {/* Unsaved dot placeholder */}
            <span style={{ width: 6 }} />
            <span
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(path);
              }}
              style={{
                fontSize: 16,
                lineHeight: 1,
                color: isActive ? "#cccccc" : "#808080",
                borderRadius: 3,
                padding: "0 2px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#404040";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              ×
            </span>
          </div>
        );
      })}
    </div>
  );
}
