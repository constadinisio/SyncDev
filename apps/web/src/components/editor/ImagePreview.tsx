"use client";

import { getAssetUrl } from "@/lib/api";

interface ImagePreviewProps {
  readonly projectId: string;
  readonly filePath: string;
  readonly fileName: string;
}

export function ImagePreview({ projectId, filePath, fileName }: ImagePreviewProps) {
  const url = getAssetUrl(projectId, filePath);
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isSvg = ext === "svg";

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-surface-100 overflow-auto p-8 gap-4">
      {/* Checkerboard background for transparency */}
      <div
        className="relative rounded-xl overflow-hidden shadow-lg shadow-black/20 border border-surface-300/40 max-w-full max-h-[70vh]"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #27272b 25%, transparent 25%), linear-gradient(-45deg, #27272b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #27272b 75%), linear-gradient(-45deg, transparent 75%, #27272b 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          backgroundColor: "#1e1e22",
        }}
      >
        {isSvg ? (
          <object data={url} type="image/svg+xml" className="max-w-full max-h-[60vh] block">
            <img src={url} alt={fileName} className="max-w-full max-h-[60vh] block" />
          </object>
        ) : (
          <img src={url} alt={fileName} className="max-w-full max-h-[60vh] block" />
        )}
      </div>

      {/* File info */}
      <div className="flex items-center gap-4 text-xs text-surface-500 font-sans">
        <span className="font-medium text-surface-700">{fileName}</span>
        <span className="uppercase">{ext}</span>
        <a
          href={url}
          download={fileName}
          className="text-brand-400 hover:text-brand-300 no-underline transition-colors duration-100"
        >
          Download
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 hover:text-brand-300 no-underline transition-colors duration-100"
        >
          Open in new tab
        </a>
      </div>
    </div>
  );
}
