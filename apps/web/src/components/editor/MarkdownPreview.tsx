"use client";

import { useMemo } from "react";
import { marked } from "marked";

interface MarkdownPreviewProps {
  readonly markdown: string;
}

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    marked.setOptions({
      gfm: true,
      breaks: true,
    });
    return marked.parse(markdown) as string;
  }, [markdown]);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 bg-surface-100 text-surface-800 font-sans text-sm leading-relaxed">
      <style>{markdownStyles}</style>
      <div
        className="md-preview max-w-3xl mx-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

const markdownStyles = `
.md-preview h1 {
  font-size: 2em;
  margin: 0.67em 0;
  padding-bottom: 0.3em;
  border-bottom: 1px solid rgba(63, 63, 70, 0.4);
  color: #e4e4e7;
  font-weight: 700;
}
.md-preview h2 {
  font-size: 1.5em;
  margin: 0.75em 0 0.5em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid rgba(63, 63, 70, 0.3);
  color: #e4e4e7;
  font-weight: 600;
}
.md-preview h3 {
  font-size: 1.25em;
  margin: 0.75em 0 0.5em;
  color: #e4e4e7;
  font-weight: 600;
}
.md-preview h4, .md-preview h5, .md-preview h6 {
  margin: 0.75em 0 0.5em;
  color: #e4e4e7;
}
.md-preview p {
  margin: 0.5em 0;
}
.md-preview a {
  color: #60a5fa;
  text-decoration: none;
}
.md-preview a:hover {
  text-decoration: underline;
}
.md-preview strong {
  color: #f87171;
  font-weight: 600;
}
.md-preview em {
  color: #a78bfa;
  font-style: italic;
}
.md-preview code {
  background-color: rgba(63, 63, 70, 0.4);
  padding: 2px 6px;
  border-radius: 6px;
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 0.9em;
  color: #4ade80;
}
.md-preview pre {
  background-color: rgba(17, 17, 19, 0.8);
  border: 1px solid rgba(63, 63, 70, 0.4);
  border-radius: 8px;
  padding: 14px 18px;
  overflow-x: auto;
  margin: 0.75em 0;
}
.md-preview pre code {
  background: none;
  padding: 0;
  border-radius: 0;
  font-size: 13px;
  color: #d4d4d8;
}
.md-preview ul, .md-preview ol {
  padding-left: 24px;
  margin: 0.5em 0;
}
.md-preview li {
  margin: 0.25em 0;
}
.md-preview blockquote {
  border-left: 3px solid rgba(96, 165, 250, 0.5);
  margin: 0.75em 0;
  padding: 4px 16px;
  color: #a1a1aa;
  background-color: rgba(59, 130, 246, 0.05);
  border-radius: 0 6px 6px 0;
}
.md-preview table {
  border-collapse: collapse;
  margin: 0.75em 0;
  width: 100%;
}
.md-preview th, .md-preview td {
  border: 1px solid rgba(63, 63, 70, 0.4);
  padding: 8px 14px;
  text-align: left;
}
.md-preview th {
  background-color: rgba(39, 39, 43, 0.8);
  font-weight: 600;
}
.md-preview hr {
  border: none;
  border-top: 1px solid rgba(63, 63, 70, 0.4);
  margin: 1.5em 0;
}
.md-preview img {
  max-width: 100%;
  border-radius: 8px;
}
`;
