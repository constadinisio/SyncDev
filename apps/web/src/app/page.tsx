"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchProjects, cloneRepository } from "@/lib/api";
import { PROJECT_TEMPLATES, generateProjectName } from "@/lib/templates";
import type { ProjectTemplate } from "@/lib/templates";

const TAG_COLORS: Record<string, string> = {
  HTML: "#f06529",
  CSS: "#2965f1",
  JavaScript: "#f0db4f",
  TypeScript: "#3178c6",
  React: "#61dafb",
  Tailwind: "#38bdf8",
  Vite: "#646cff",
  "Node.js": "#68a063",
  Express: "#808080",
  Python: "#3776ab",
  FastAPI: "#009688",
  "Multi-page": "#f87171",
};

const CARD_GRADIENTS: Record<string, string> = {
  empty: "from-surface-400/20 to-surface-500/10",
  "html-css-js": "from-orange-500/20 to-amber-500/10",
  nextjs: "from-surface-300/30 to-surface-400/10",
  "react-vite": "from-violet-500/20 to-blue-500/10",
  "node-api": "from-green-500/20 to-emerald-500/10",
  python: "from-blue-500/20 to-sky-500/10",
  "static-site": "from-rose-500/20 to-pink-500/10",
};

const CARD_BORDER_COLORS: Record<string, string> = {
  empty: "hover:border-surface-500",
  "html-css-js": "hover:border-orange-500/60",
  nextjs: "hover:border-surface-500",
  "react-vite": "hover:border-violet-500/60",
  "node-api": "hover:border-green-500/60",
  python: "hover:border-blue-500/60",
  "static-site": "hover:border-rose-500/60",
};

function TemplateCard({
  template,
  onSelect,
}: {
  readonly template: ProjectTemplate;
  readonly onSelect: (t: ProjectTemplate) => void;
}) {
  const gradient = CARD_GRADIENTS[template.id] ?? CARD_GRADIENTS.empty;
  const borderHover = CARD_BORDER_COLORS[template.id] ?? CARD_BORDER_COLORS.empty;

  return (
    <button
      onClick={() => onSelect(template)}
      className={`group relative flex flex-col items-start gap-3 p-5 bg-gradient-to-br ${gradient}
        border border-surface-300/50 ${borderHover} rounded-xl cursor-pointer w-56
        transition-all duration-200 hover:scale-[1.03] hover:shadow-lg hover:shadow-black/20
        text-left animate-fade-in`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
          {template.icon}
        </span>
        <span className="text-sm font-semibold text-surface-900">
          {template.name}
        </span>
      </div>
      <span className="text-xs text-surface-600 leading-relaxed">
        {template.description}
      </span>
      {template.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-1">
          {template.tags.map((tag) => {
            const color = TAG_COLORS[tag] ?? "#71717a";
            return (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${color}18`,
                  color: color,
                  border: `1px solid ${color}30`,
                }}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}

function ProjectCard({
  name,
  onClick,
  onDashboard,
  index,
}: {
  readonly name: string;
  readonly onClick: () => void;
  readonly onDashboard: () => void;
  readonly index: number;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 bg-surface-150 border border-surface-300/50
        hover:border-brand-500/40 hover:bg-surface-200 rounded-lg
        transition-all duration-200 group animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <button
        onClick={onClick}
        className="flex items-center gap-3 bg-transparent border-none cursor-pointer flex-1 min-w-0 p-0"
      >
        <span className="text-brand-400 text-lg group-hover:scale-110 transition-transform shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </span>
        <span className="text-sm text-surface-800 group-hover:text-surface-950 font-medium transition-colors truncate">
          {name}
        </span>
      </button>
      <button
        onClick={onDashboard}
        title="Dashboard"
        className="bg-transparent border-none text-surface-400 hover:text-surface-700 cursor-pointer
          p-1 rounded opacity-0 group-hover:opacity-100 transition-all duration-100 shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
      </button>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<string[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const handleClone = useCallback(async () => {
    const url = cloneUrl.trim();
    if (!url) return;

    // Extract project name from URL (e.g., "my-repo" from "https://github.com/user/my-repo.git")
    const repoName = url.split("/").pop()?.replace(/\.git$/, "") ?? generateProjectName();
    const safeName = repoName.replace(/[^a-zA-Z0-9._-]/g, "_");

    setCloning(true);
    setCloneError(null);

    try {
      const result = await cloneRepository(safeName, url);
      if (result.error) {
        setCloneError(result.error);
        return;
      }
      // Clone succeeded — scan and open the project
      router.push(`/project/${encodeURIComponent(safeName)}?scan=1`);
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : "Clone failed");
    } finally {
      setCloning(false);
    }
  }, [cloneUrl, router]);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  const handleCreate = useCallback(() => {
    const sanitized = projectName.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
    if (sanitized) {
      router.push(`/project/${encodeURIComponent(sanitized)}`);
    }
  }, [projectName, router]);

  const handleTemplateSelect = useCallback(
    (template: ProjectTemplate) => {
      const name =
        projectName.trim().replace(/[^a-zA-Z0-9._-]/g, "_") ||
        generateProjectName();
      if (template.id === "empty") {
        router.push(`/project/${encodeURIComponent(name)}`);
      } else {
        router.push(
          `/project/${encodeURIComponent(name)}?template=${template.id}`,
        );
      }
    },
    [projectName, router],
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-surface-0 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-brand-600/8 via-brand-500/4 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-purple-600/6 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-16 max-w-5xl w-full">
        {/* Hero */}
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-surface-950 tracking-tight">
              Sync<span className="text-brand-400">Dev</span>
            </h1>
          </div>
          <p className="text-surface-600 text-base max-w-md text-center leading-relaxed">
            Real-time collaborative code editor. Write code together, see changes instantly.
          </p>
        </div>

        {/* Create / Open project */}
        <div className="flex flex-col items-center gap-3 w-full max-w-md animate-slide-up">
          <label className="text-xs font-medium text-surface-500 uppercase tracking-wider">
            Create or open a project
          </label>
          <div className={`flex w-full rounded-xl overflow-hidden border transition-all duration-200 shadow-lg shadow-black/10
            ${inputFocused ? "border-brand-500/60 shadow-brand-500/10" : "border-surface-300/50"}`}>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Project name (e.g. my-app)"
              className="flex-1 px-5 py-3.5 bg-surface-100 text-surface-900 text-base placeholder:text-surface-500
                outline-none font-medium"
            />
            <button
              onClick={handleCreate}
              className="px-7 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-base
                transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              Open
            </button>
          </div>
        </div>

        {/* Templates */}
        <div className="flex flex-col items-center gap-5 w-full">
          <label className="text-xs font-medium text-surface-500 uppercase tracking-wider">
            Start from a template
          </label>
          <div className="flex gap-4 flex-wrap justify-center max-w-4xl">
            {PROJECT_TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onSelect={handleTemplateSelect}
              />
            ))}
          </div>
        </div>

        {/* Clone from Git */}
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <button
            onClick={() => setCloneOpen((p) => !p)}
            className="text-xs font-medium text-surface-500 uppercase tracking-wider hover:text-surface-700
              cursor-pointer bg-transparent border-none flex items-center gap-1.5 transition-colors duration-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
            </svg>
            Clone from Git
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${cloneOpen ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {cloneOpen && (
            <div className="flex flex-col gap-2 w-full animate-slide-down">
              <div className="flex w-full rounded-xl overflow-hidden border border-surface-300/50 shadow-lg shadow-black/10">
                <input
                  type="text"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleClone()}
                  placeholder="https://github.com/user/repo.git"
                  disabled={cloning}
                  className="flex-1 px-5 py-3 bg-surface-100 text-surface-900 text-sm placeholder:text-surface-500
                    outline-none font-medium disabled:opacity-50"
                />
                <button
                  onClick={handleClone}
                  disabled={cloning || !cloneUrl.trim()}
                  className={`px-6 py-3 font-semibold text-sm transition-colors duration-150 cursor-pointer whitespace-nowrap
                    ${cloning || !cloneUrl.trim()
                      ? "bg-surface-300 text-surface-500 cursor-not-allowed"
                      : "bg-brand-600 hover:bg-brand-500 text-white"
                    }`}
                >
                  {cloning ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Cloning...
                    </span>
                  ) : (
                    "Clone"
                  )}
                </button>
              </div>
              {cloneError && (
                <div className="text-accent-red text-xs px-2 animate-fade-in">
                  {cloneError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent projects */}
        {projects.length > 0 && (
          <div className="flex flex-col items-center gap-4 w-full animate-slide-up">
            <label className="text-xs font-medium text-surface-500 uppercase tracking-wider">
              Recent projects
            </label>
            <div className="flex gap-3 flex-wrap justify-center max-w-3xl">
              {projects.map((p, i) => (
                <ProjectCard
                  key={p}
                  name={p}
                  index={i}
                  onClick={() => router.push(`/project/${encodeURIComponent(p)}`)}
                  onDashboard={() => router.push(`/project/${encodeURIComponent(p)}/dashboard`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
