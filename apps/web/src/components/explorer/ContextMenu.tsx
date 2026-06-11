"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface ContextMenuProps {
  readonly x: number;
  readonly y: number;
  readonly items: readonly { label: string; action: () => void }[];
  readonly onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Small delay to prevent the opening right-click from immediately closing the menu
    const timer = setTimeout(() => {
      mountedRef.current = true;
    }, 100);

    const handleMouseDown = (e: MouseEvent) => {
      if (!mountedRef.current) return;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
      mountedRef.current = false;
    };
  }, [onClose]);

  // Prevent the menu from appearing off-screen
  const adjustedX = typeof window !== "undefined" ? Math.min(x, window.innerWidth - 200) : x;
  const adjustedY = typeof window !== "undefined" ? Math.min(y, window.innerHeight - 200) : y;

  const handleItemClick = useCallback(
    (action: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      onClose();
      // Run action after menu closes
      setTimeout(() => action(), 10);
    },
    [onClose],
  );

  const menu = (
    <div
      ref={ref}
      className="fixed bg-surface-150 border border-surface-300/60 rounded-lg py-1 min-w-[170px]
        shadow-xl shadow-black/40"
      style={{ top: adjustedY, left: adjustedX, zIndex: 9999 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <div
          key={item.label}
          onClick={() => handleItemClick(item.action)}
          className="px-4 py-1.5 text-[13px] text-surface-700 cursor-pointer font-sans
            hover:bg-brand-600/20 hover:text-brand-300 transition-colors duration-75 select-none"
        >
          {item.label}
        </div>
      ))}
    </div>
  );

  // Render via portal to escape overflow:hidden containers
  return createPortal(menu, document.body);
}
