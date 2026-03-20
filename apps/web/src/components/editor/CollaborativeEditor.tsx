"use client";

import { useRef, useEffect } from "react";
import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import type * as monacoTypes from "monaco-editor";
import type { ProblemEntry } from "./ProblemsPanel";
import type { EditorSettings } from "@/hooks/useSettings";
import { MonacoBinding } from "y-monaco";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";

interface CollaborativeEditorProps {
  readonly ytext: Y.Text;
  readonly provider: WebsocketProvider;
  readonly language?: string;
  readonly onCursorChange?: (line: number, column: number) => void;
  readonly commentLines?: ReadonlySet<number>;
  readonly onGlyphClick?: (line: number) => void;
  readonly onMarkersChange?: (markers: readonly ProblemEntry[]) => void;
  readonly settings?: EditorSettings;
}

export function CollaborativeEditor({
  ytext,
  provider,
  language = "typescript",
  onCursorChange,
  commentLines,
  onGlyphClick,
  onMarkersChange,
  settings,
}: CollaborativeEditorProps) {
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const commentLinesRef = useRef<ReadonlySet<number>>(new Set());

  // Keep commentLinesRef in sync
  useEffect(() => {
    commentLinesRef.current = commentLines ?? new Set();
    updateDecorations();
  }, [commentLines]);

  const updateDecorations = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const lines = commentLinesRef.current;
    const newDecorations: monacoTypes.editor.IModelDeltaDecoration[] = [];

    lines.forEach((line) => {
      newDecorations.push({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          glyphMarginClassName: "comment-glyph-icon",
          glyphMarginHoverMessage: { value: "Click to view comments" },
        },
      });
    });

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations,
    );
  };

  const handleEditorWillMount: BeforeMount = (monacoInstance) => {
    // Configure TypeScript language service
    monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monacoInstance.languages.typescript.ScriptTarget.ESNext,
      module: monacoInstance.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monacoInstance.languages.typescript.ModuleResolutionKind.NodeJs,
      allowJs: true,
      checkJs: true,
      jsx: monacoInstance.languages.typescript.JsxEmit.React,
      strict: true,
      esModuleInterop: true,
    });

    // Configure JavaScript defaults too
    monacoInstance.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monacoInstance.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monacoInstance.languages.typescript.ScriptTarget.ESNext,
      module: monacoInstance.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monacoInstance.languages.typescript.ModuleResolutionKind.NodeJs,
      allowJs: true,
      checkJs: true,
      jsx: monacoInstance.languages.typescript.JsxEmit.React,
    });
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    const model = editor.getModel();
    if (!model) return;

    bindingRef.current = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      provider.awareness,
    );

    editor.onDidChangeCursorPosition((e) => {
      onCursorChange?.(e.position.lineNumber, e.position.column);
    });

    // Handle glyph margin clicks
    editor.onMouseDown((e) => {
      if (
        e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
        e.target.position
      ) {
        onGlyphClick?.(e.target.position.lineNumber);
      }
    });

    // Listen for marker/diagnostic changes
    editor.onDidChangeModelDecorations(() => {
      const editorModel = editor.getModel();
      if (editorModel && onMarkersChange) {
        const markers = monaco.editor.getModelMarkers({
          resource: editorModel.uri,
        });
        const severityMap: Record<number, ProblemEntry["severity"]> = {
          [monaco.MarkerSeverity.Error]: "error",
          [monaco.MarkerSeverity.Warning]: "warning",
          [monaco.MarkerSeverity.Info]: "info",
          [monaco.MarkerSeverity.Hint]: "hint",
        };
        const problems: ProblemEntry[] = markers.map((m) => ({
          severity: severityMap[m.severity] ?? "info",
          message: m.message,
          startLineNumber: m.startLineNumber,
          startColumn: m.startColumn,
          source: m.source ?? undefined,
        }));
        onMarkersChange(problems);
      }
    });

    // Inject CSS for comment glyph icon
    const styleId = "comment-glyph-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .comment-glyph-icon {
          background-color: #e5c07b;
          border-radius: 50%;
          width: 8px !important;
          height: 8px !important;
          margin-left: 4px;
          margin-top: 6px;
          cursor: pointer;
        }
      `;
      document.head.appendChild(style);
    }

    // Apply initial decorations
    updateDecorations();
  };

  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
    };
  }, []);

  const editorTheme = settings?.theme ?? "vs-dark";
  const editorFontSize = settings?.fontSize ?? 14;
  const editorTabSize = settings?.tabSize ?? 2;
  const editorMinimap = settings?.minimap ?? true;
  const editorWordWrap = settings?.wordWrap ? "on" as const : "off" as const;
  const editorLineNumbers = (settings?.lineNumbers ?? "on") as "on" | "off" | "relative";

  return (
    <Editor
      height="100%"
      language={language}
      theme={editorTheme}
      beforeMount={handleEditorWillMount}
      onMount={handleEditorMount}
      options={{
        minimap: { enabled: editorMinimap },
        fontSize: editorFontSize,
        lineNumbers: editorLineNumbers,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: editorTabSize,
        wordWrap: editorWordWrap,
        glyphMargin: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        parameterHints: { enabled: true },
        wordBasedSuggestions: "currentDocument",
        "semanticHighlighting.enabled": true,
        bracketPairColorization: { enabled: true },
        autoClosingBrackets: "always",
        autoClosingQuotes: "always",
        formatOnPaste: true,
        formatOnType: true,
        folding: true,
        foldingStrategy: "auto",
        showFoldingControls: "always",
        matchBrackets: "always",
        renderWhitespace: "selection",
        guides: {
          bracketPairs: true,
          indentation: true,
        },
      }}
    />
  );
}
