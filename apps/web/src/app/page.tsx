"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchProjects } from "@/lib/api";
import { PROJECT_TEMPLATES, generateProjectName } from "@/lib/templates";
import type { ProjectTemplate } from "@/lib/templates";

const TAG_COLORS: Record<string, string> = {
  HTML: "#e44d26",
  CSS: "#264de4",
  JavaScript: "#f0db4f",
  TypeScript: "#3178c6",
  React: "#61dafb",
  Tailwind: "#38bdf8",
  Vite: "#646cff",
  "Node.js": "#68a063",
  Express: "#808080",
  Python: "#3776ab",
  FastAPI: "#009688",
  "Multi-page": "#e06c75",
};

const CARD_BORDERS: Record<string, string> = {
  empty: "#555555",
  "html-css-js": "#e44d26",
  nextjs: "#808080",
  "react-vite": "#646cff",
  "node-api": "#68a063",
  python: "#3776ab",
  "static-site": "#e06c75",
};

function TemplateCard({
  template,
  onSelect,
}: {
  readonly template: ProjectTemplate;
  readonly onSelect: (t: ProjectTemplate) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const borderColor = CARD_BORDERS[template.id] ?? "#555555";

  return (
    <button
      onClick={() => onSelect(template)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        padding: "16px 20px",
        backgroundColor: hovered ? "#2a2a2a" : "#252526",
        border: `1px solid ${hovered ? borderColor : "#404040"}`,
        borderRadius: 6,
        cursor: "pointer",
        width: 220,
        textAlign: "left",
        transition: "border-color 0.15s, background-color 0.15s, box-shadow 0.15s",
        boxShadow: hovered ? `0 0 12px ${borderColor}33` : "none",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 24 }}>{template.icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4" }}>
          {template.name}
        </span>
      </div>
      <span style={{ fontSize: 12, color: "#808080", lineHeight: 1.4 }}>
        {template.description}
      </span>
      {template.tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
          {template.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 3,
                backgroundColor: `${TAG_COLORS[tag] ?? "#555"}22`,
                color: TAG_COLORS[tag] ?? "#999",
                border: `1px solid ${TAG_COLORS[tag] ?? "#555"}44`,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<string[]>([]);

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

  const inputStyle = {
    padding: "8px 12px",
    fontSize: 16,
    backgroundColor: "#2d2d2d",
    color: "#d4d4d4",
    border: "1px solid #404040",
    borderRadius: 4,
    width: 300,
  } as const;

  const buttonStyle = {
    padding: "8px 20px",
    fontSize: 16,
    backgroundColor: "#0e639c",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  } as const;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "#1e1e1e",
        color: "#d4d4d4",
        gap: 40,
        padding: "40px 20px",
      }}
    >
      <h1 style={{ marginBottom: 0 }}>Collab Editor</h1>

      {/* Create / open project */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 14, color: "#808080" }}>Create or open a project</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Project name (e.g. my-app)"
            style={inputStyle}
          />
          <button onClick={handleCreate} style={buttonStyle}>
            Open
          </button>
        </div>
      </div>

      {/* Template selection */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 14, color: "#808080" }}>Start from template</span>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
            maxWidth: 960,
          }}
        >
          {PROJECT_TEMPLATES.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onSelect={handleTemplateSelect}
            />
          ))}
        </div>
      </div>

      {/* Existing projects */}
      {projects.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, color: "#808080" }}>Recent projects</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {projects.map((p) => (
              <button
                key={p}
                onClick={() => router.push(`/project/${encodeURIComponent(p)}`)}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  backgroundColor: "#2d2d2d",
                  color: "#d4d4d4",
                  border: "1px solid #404040",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
