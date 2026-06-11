"use client";

interface BreadcrumbsProps {
  readonly filePath: string;
  readonly projectId: string;
}

export function Breadcrumbs({ filePath, projectId }: BreadcrumbsProps) {
  const segments = filePath.split("/").filter(Boolean);

  return (
    <div className="px-4 py-1 bg-surface-100 border-b border-surface-300/40 flex items-center gap-1
      font-sans text-xs shrink-0 overflow-hidden whitespace-nowrap">
      <span className="text-surface-500">{projectId}</span>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-surface-400">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span
              className={`transition-colors duration-100
                ${isLast ? "text-surface-800 font-medium" : "text-surface-500 hover:text-surface-700 cursor-pointer"}`}
            >
              {segment}
            </span>
          </span>
        );
      })}
    </div>
  );
}
