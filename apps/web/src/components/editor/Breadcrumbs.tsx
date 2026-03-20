"use client";

interface BreadcrumbsProps {
  readonly filePath: string;
  readonly projectId: string;
}

export function Breadcrumbs({ filePath, projectId }: BreadcrumbsProps) {
  const segments = filePath.split("/").filter(Boolean);

  return (
    <div
      style={{
        padding: "4px 16px",
        backgroundColor: "#1e1e1e",
        borderBottom: "1px solid #333333",
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "system-ui, sans-serif",
        fontSize: 12,
        flexShrink: 0,
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      {/* Project root */}
      <span style={{ color: "#808080" }}>{projectId}</span>

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={index} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "#555555", fontSize: 10 }}>›</span>
            <span
              style={{
                color: isLast ? "#d4d4d4" : "#808080",
                cursor: isLast ? "default" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isLast) {
                  e.currentTarget.style.color = "#d4d4d4";
                }
              }}
              onMouseLeave={(e) => {
                if (!isLast) {
                  e.currentTarget.style.color = "#808080";
                }
              }}
            >
              {segment}
            </span>
          </span>
        );
      })}
    </div>
  );
}
