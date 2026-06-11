"use client";

import { useCallback, useState } from "react";

interface TabBarProps {
  readonly openTabs: readonly string[];
  readonly activeTab: string | null;
  readonly onTabSelect: (path: string) => void;
  readonly onTabClose: (path: string) => void;
  readonly onTabReorder?: (from: number, to: number) => void;
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function TabBar({
  openTabs,
  activeTab,
  onTabSelect,
  onTabClose,
  onTabReorder,
}: TabBarProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, path: string) => {
      if (e.button === 1) {
        e.preventDefault();
        onTabClose(path);
      }
    },
    [onTabClose],
  );

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/tab-index", String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData("text/tab-index"), 10);
      if (!isNaN(fromIndex) && fromIndex !== toIndex && onTabReorder) {
        onTabReorder(fromIndex, toIndex);
      }
      setDragOverIndex(null);
      setDragIndex(null);
    },
    [onTabReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDragOverIndex(null);
    setDragIndex(null);
  }, []);

  if (openTabs.length === 0) return null;

  return (
    <div className="flex bg-surface-150 border-b border-surface-300/60 overflow-x-auto overflow-y-hidden shrink-0 h-[37px]">
      {openTabs.map((path, index) => {
        const isActive = path === activeTab;
        const isDragging = dragIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={path}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onTabSelect(path)}
            onMouseDown={(e) => handleMouseDown(e, path)}
            title={path}
            className={`group flex items-center gap-2 px-4 h-full cursor-pointer text-[13px] font-sans
              whitespace-nowrap select-none shrink-0 transition-all duration-100 border-r border-surface-200/60
              ${isDragging ? "opacity-40" : ""}
              ${isDragOver ? "border-l-2 border-l-brand-500" : ""}
              ${
                isActive
                  ? "bg-surface-100 text-surface-950 border-t-2 border-t-brand-500"
                  : "bg-surface-200 text-surface-600 border-t-2 border-t-transparent hover:text-surface-700 hover:bg-surface-150"
              }`}
          >
            <span>{getFileName(path)}</span>
            <span className="w-1.5" />
            <span
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(path);
              }}
              className={`text-base leading-none rounded p-0.5 transition-all duration-100
                ${isActive ? "text-surface-600" : "text-surface-500 opacity-0 group-hover:opacity-100"}
                hover:bg-surface-300/60 hover:text-surface-800`}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </div>
        );
      })}
    </div>
  );
}
