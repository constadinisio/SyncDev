"use client";

import dynamic from "next/dynamic";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => ({ default: mod.DiffEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-surface-100 text-surface-500 text-sm">
        Loading diff editor...
      </div>
    ),
  },
);

interface DiffViewerProps {
  readonly filePath: string;
  readonly original: string;
  readonly modified: string;
  readonly onClose: () => void;
}

function inferLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    css: "css",
    html: "html",
    json: "json",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
  };
  return map[ext] ?? "plaintext";
}

export function DiffViewer({ filePath, original, modified, onClose }: DiffViewerProps) {
  const language = inferLanguage(filePath);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[90%] max-w-[1100px] h-[80vh] bg-surface-100 border border-surface-300/60
          rounded-xl flex flex-col overflow-hidden shadow-2xl shadow-black/40 animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-150 border-b border-surface-300/40 font-sans text-[13px] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-surface-500">Diff:</span>
            <span className="text-surface-800 font-medium">{filePath}</span>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-surface-500 hover:text-surface-800 cursor-pointer p-1 rounded
              transition-colors duration-100"
          >
            <svg
              width="16"
              height="16"
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
          </button>
        </div>

        {/* Diff Editor */}
        <div className="flex-1">
          <DiffEditor
            height="100%"
            language={language}
            original={original}
            modified={modified}
            theme="vs-dark"
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineNumbers: "on",
              folding: true,
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    </div>
  );
}
