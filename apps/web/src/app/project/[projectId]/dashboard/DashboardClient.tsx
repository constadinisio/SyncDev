"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  fetchProjectTree,
  getApiBase,
  type TreeNode,
} from "@/lib/api";

interface ProjectStats {
  readonly totalFiles: number;
  readonly totalFolders: number;
  readonly languageBreakdown: Record<string, number>;
  readonly todoComments: readonly { file: string; line: number; text: string }[];
  readonly dependencies: Record<string, string>;
}

const EXT_LABELS: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript (JSX)",
  js: "JavaScript", jsx: "JavaScript (JSX)",
  py: "Python", rs: "Rust", go: "Go", java: "Java",
  css: "CSS", html: "HTML", json: "JSON", md: "Markdown",
  yml: "YAML", yaml: "YAML", svg: "SVG",
};

const EXT_COLORS: Record<string, string> = {
  ts: "#3178c6", tsx: "#3178c6",
  js: "#f7df1e", jsx: "#f7df1e",
  py: "#3776ab", rs: "#dea584", go: "#00add8", java: "#f89820",
  css: "#1572b6", html: "#e34f26", json: "#a1a1aa", md: "#d4d4d8",
  yml: "#cb171e", yaml: "#cb171e",
};

function countTree(nodes: readonly TreeNode[]): { files: number; folders: number; extensions: Record<string, number> } {
  let files = 0;
  let folders = 0;
  const extensions: Record<string, number> = {};

  for (const node of nodes) {
    if (node.type === "file") {
      files++;
      const ext = node.name.split(".").pop()?.toLowerCase() ?? "other";
      extensions[ext] = (extensions[ext] ?? 0) + 1;
    } else {
      folders++;
      const sub = countTree(node.children);
      files += sub.files;
      folders += sub.folders;
      for (const [ext, count] of Object.entries(sub.extensions)) {
        extensions[ext] = (extensions[ext] ?? 0) + count;
      }
    }
  }

  return { files, folders, extensions };
}

interface StatCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 p-5 bg-surface-150 border border-surface-300/40 rounded-xl">
      <div className="w-10 h-10 rounded-lg bg-brand-600/10 flex items-center justify-center text-brand-400">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-surface-900">{value}</div>
        <div className="text-xs text-surface-500">{label}</div>
      </div>
    </div>
  );
}

export function DashboardClient({ projectId }: { readonly projectId: string }) {
  const router = useRouter();
  const decodedProjectId = decodeURIComponent(projectId);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [deps, setDeps] = useState<Record<string, string>>({});
  const [todos, setTodos] = useState<readonly { file: string; line: number; text: string }[]>([]);

  useEffect(() => {
    setLoading(true);
    fetchProjectTree(decodedProjectId)
      .then((data) => setTree(data.tree))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [decodedProjectId]);

  // Fetch TODOs and deps from the server
  useEffect(() => {
    // Search for TODO/FIXME comments
    const searchTodos = async () => {
      try {
        const res = await fetch(
          `${getApiBase()}/api/search/${encodeURIComponent(decodedProjectId)}?q=${encodeURIComponent("TODO|FIXME")}&regex=1`,
        );
        if (res.ok) {
          const data = await res.json();
          const matches = (data.matches ?? []).map((m: { filePath: string; line: number; content: string }) => ({
            file: m.filePath,
            line: m.line,
            text: m.content.trim(),
          }));
          setTodos(matches);
        }
      } catch {
        // Silently fail
      }
    };

    // Try to get package.json deps
    const fetchDeps = async () => {
      try {
        const res = await fetch(
          `${getApiBase()}/api/terminal/${encodeURIComponent(decodedProjectId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: "cat package.json 2>/dev/null" }),
          },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.exitCode === 0 && data.stdout) {
            const pkg = JSON.parse(data.stdout);
            setDeps({ ...pkg.dependencies, ...pkg.devDependencies });
          }
        }
      } catch {
        // No package.json
      }
    };

    searchTodos();
    fetchDeps();
  }, [decodedProjectId]);

  const { files, folders, extensions } = countTree(tree);
  const sortedExts = Object.entries(extensions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  const totalFilesByExt = sortedExts.reduce((s, [, c]) => s + c, 0);

  return (
    <div className="min-h-screen bg-surface-0 text-surface-800 font-sans">
      {/* Header */}
      <div className="border-b border-surface-300/40 bg-surface-100">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/project/${encodeURIComponent(decodedProjectId)}`)}
              className="p-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-600 border-none
                cursor-pointer transition-colors duration-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-surface-950 m-0">{decodedProjectId}</h1>
              <p className="text-xs text-surface-500 m-0 mt-0.5">Project Dashboard</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/project/${encodeURIComponent(decodedProjectId)}`)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium
              rounded-lg cursor-pointer border-none transition-colors duration-150"
          >
            Open Editor
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-surface-500">
          <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2" />
          Loading...
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Files"
              value={files}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              }
            />
            <StatCard
              label="Folders"
              value={folders}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              }
            />
            <StatCard
              label="Languages"
              value={Object.keys(extensions).length}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
              }
            />
          </div>

          {/* Language breakdown */}
          <div className="bg-surface-150 border border-surface-300/40 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-surface-900 mb-4">Language Breakdown</h2>
            <div className="flex flex-col gap-2">
              {sortedExts.map(([ext, count]) => {
                const pct = totalFilesByExt > 0 ? (count / totalFilesByExt) * 100 : 0;
                const color = EXT_COLORS[ext] ?? "#71717a";
                const label = EXT_LABELS[ext] ?? ext.toUpperCase();
                return (
                  <div key={ext} className="flex items-center gap-3">
                    <span className="text-xs text-surface-600 w-28 truncate">{label}</span>
                    <div className="flex-1 h-2 bg-surface-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="text-xs text-surface-500 w-12 text-right">{count} file{count !== 1 ? "s" : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TODOs */}
          {todos.length > 0 && (
            <div className="bg-surface-150 border border-surface-300/40 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <span className="text-accent-yellow">TODO</span> / FIXME Comments
                <span className="text-[11px] text-surface-500 bg-surface-300 px-2 py-0.5 rounded-full">
                  {todos.length}
                </span>
              </h2>
              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                {todos.map((todo, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-surface-200
                      transition-colors duration-75 cursor-pointer"
                    onClick={() => router.push(`/project/${encodeURIComponent(decodedProjectId)}`)}
                  >
                    <span className="text-surface-500 shrink-0">{todo.file}:{todo.line}</span>
                    <span className="text-surface-700 truncate">{todo.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {Object.keys(deps).length > 0 && (
            <div className="bg-surface-150 border border-surface-300/40 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-surface-900 mb-3">
                Dependencies
                <span className="text-[11px] text-surface-500 bg-surface-300 px-2 py-0.5 rounded-full ml-2">
                  {Object.keys(deps).length}
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 max-h-60 overflow-y-auto">
                {Object.entries(deps)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([name, version]) => (
                    <div key={name} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-surface-700 font-medium">{name}</span>
                      <span className="text-surface-500 font-mono">{version}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
