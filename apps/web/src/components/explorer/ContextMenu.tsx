"use client";

import { useEffect, useRef } from "react";

interface ContextMenuProps {
  readonly x: number;
  readonly y: number;
  readonly items: readonly { label: string; action: () => void }[];
  readonly onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: y,
        left: x,
        backgroundColor: "#252526",
        border: "1px solid #454545",
        borderRadius: 4,
        padding: "4px 0",
        zIndex: 1000,
        minWidth: 160,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          onClick={() => {
            item.action();
            onClose();
          }}
          style={{
            padding: "6px 16px",
            fontSize: 13,
            color: "#cccccc",
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#094771";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
