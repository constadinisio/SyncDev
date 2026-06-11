"use client";

import dynamic from "next/dynamic";

const CollaborativeEditorInner = dynamic(
  () =>
    import("./CollaborativeEditor").then((mod) => ({
      default: mod.CollaborativeEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-surface-100 animate-pulse-glow">
        <div className="flex flex-col items-center gap-3 text-surface-500">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-surface-400"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span className="text-xs font-sans">Loading editor...</span>
        </div>
      </div>
    ),
  },
);

export { CollaborativeEditorInner as CollaborativeEditor };
