"use client";

import { getAssetUrl } from "@/lib/api";

interface BinaryPreviewProps {
  readonly projectId: string;
  readonly filePath: string;
  readonly fileName: string;
}

export function BinaryPreview({ projectId, filePath, fileName }: BinaryPreviewProps) {
  const url = getAssetUrl(projectId, filePath);
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = ext === "pdf";

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-surface-100 gap-4 p-8">
      {isPdf ? (
        <iframe
          src={url}
          className="w-full flex-1 rounded-xl border border-surface-300/40"
          title={fileName}
        />
      ) : (
        <>
          <div className="w-20 h-20 rounded-2xl bg-surface-200 border border-surface-300/40 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-surface-500">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-surface-800 font-medium text-sm">{fileName}</span>
            <span className="text-surface-500 text-xs uppercase">{ext} file — binary content</span>
          </div>
          <a
            href={url}
            download={fileName}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium
              rounded-lg no-underline transition-colors duration-150"
          >
            Download
          </a>
        </>
      )}
    </div>
  );
}
