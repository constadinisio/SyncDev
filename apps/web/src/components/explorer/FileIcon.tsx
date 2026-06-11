"use client";

interface FileIconProps {
  readonly name: string;
  readonly type: "file" | "folder";
  readonly expanded?: boolean;
}

const EXT_COLORS: Record<string, string> = {
  ts: "#3178c6",
  tsx: "#3178c6",
  js: "#f7df1e",
  jsx: "#f7df1e",
  html: "#e34f26",
  css: "#1572b6",
  json: "#a1a1aa",
  md: "#d4d4d8",
  py: "#3776ab",
  go: "#00add8",
  rs: "#dea584",
  java: "#f89820",
  yml: "#cb171e",
  yaml: "#cb171e",
};

function getExtColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_COLORS[ext] ?? "#71717a";
}

export function FileIcon({ name, type, expanded }: FileIconProps) {
  if (type === "folder") {
    return (
      <span className="w-4 text-center shrink-0">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-amber-400 transition-transform duration-100 ${expanded ? "" : "-rotate-90"}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    );
  }

  return (
    <span className="w-4 text-center text-xs shrink-0" style={{ color: getExtColor(name) }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <circle cx="12" cy="12" r="4" />
      </svg>
    </span>
  );
}
