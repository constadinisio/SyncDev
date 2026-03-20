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
  json: "#a8b1c2",
  md: "#ffffff",
  py: "#3776ab",
  go: "#00add8",
  rs: "#dea584",
  java: "#f89820",
  yml: "#cb171e",
  yaml: "#cb171e",
};

function getExtColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_COLORS[ext] ?? "#808080";
}

export function FileIcon({ name, type, expanded }: FileIconProps) {
  if (type === "folder") {
    return (
      <span style={{ color: "#dcb67a", fontSize: 14, width: 16, textAlign: "center" }}>
        {expanded ? "▾" : "▸"}
      </span>
    );
  }

  return (
    <span style={{ color: getExtColor(name), fontSize: 12, width: 16, textAlign: "center" }}>
      ●
    </span>
  );
}
