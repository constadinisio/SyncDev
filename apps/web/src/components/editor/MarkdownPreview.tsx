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
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 32px",
        backgroundColor: "#1e1e1e",
        color: "#d4d4d4",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      <style>{markdownStyles}</style>
      <div
        className="md-preview"
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
  border-bottom: 1px solid #404040;
  color: #e5c07b;
}
.md-preview h2 {
  font-size: 1.5em;
  margin: 0.75em 0 0.5em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid #333333;
  color: #e5c07b;
}
.md-preview h3 {
  font-size: 1.25em;
  margin: 0.75em 0 0.5em;
  color: #e5c07b;
}
.md-preview h4, .md-preview h5, .md-preview h6 {
  margin: 0.75em 0 0.5em;
  color: #e5c07b;
}
.md-preview p {
  margin: 0.5em 0;
}
.md-preview a {
  color: #61afef;
  text-decoration: none;
}
.md-preview a:hover {
  text-decoration: underline;
}
.md-preview strong {
  color: #e06c75;
  font-weight: 600;
}
.md-preview em {
  color: #c678dd;
  font-style: italic;
}
.md-preview code {
  background-color: #2d2d2d;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 0.9em;
  color: #98c379;
}
.md-preview pre {
  background-color: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 4px;
  padding: 12px 16px;
  overflow-x: auto;
  margin: 0.75em 0;
}
.md-preview pre code {
  background: none;
  padding: 0;
  border-radius: 0;
  font-size: 13px;
  color: #d4d4d4;
}
.md-preview ul, .md-preview ol {
  padding-left: 24px;
  margin: 0.5em 0;
}
.md-preview li {
  margin: 0.25em 0;
}
.md-preview blockquote {
  border-left: 3px solid #555555;
  margin: 0.75em 0;
  padding: 4px 16px;
  color: #808080;
  background-color: #2a2a2a;
}
.md-preview table {
  border-collapse: collapse;
  margin: 0.75em 0;
  width: 100%;
}
.md-preview th, .md-preview td {
  border: 1px solid #404040;
  padding: 6px 12px;
  text-align: left;
}
.md-preview th {
  background-color: #2d2d2d;
  font-weight: 600;
}
.md-preview hr {
  border: none;
  border-top: 1px solid #404040;
  margin: 1em 0;
}
.md-preview img {
  max-width: 100%;
}
`;
