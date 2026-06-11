"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";

interface TooltipProps {
  readonly content: string;
  readonly children: ReactNode;
  readonly side?: "top" | "bottom" | "left" | "right";
  readonly delay?: number;
}

export function Tooltip({ content, children, side = "bottom", delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          className={`absolute z-[9999] px-2.5 py-1.5 text-[11px] font-sans font-medium
            bg-surface-0 text-surface-800 border border-surface-300/60 rounded-lg
            shadow-lg shadow-black/30 whitespace-nowrap pointer-events-none
            animate-fade-in ${positionClasses[side]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
