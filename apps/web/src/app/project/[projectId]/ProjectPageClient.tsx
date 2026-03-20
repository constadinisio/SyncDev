"use client";

import { useState, useEffect, useCallback } from "react";
import { FileExplorer } from "@/components/explorer/FileExplorer";
import { CollaborativeEditor } from "@/components/editor/CollaborativeEditor";
import { ConnectionStatus } from "@/components/editor/ConnectionStatus";
import { TabBar } from "@/components/editor/TabBar";
import { StatusBar } from "@/components/editor/StatusBar";
import { QuickOpen } from "@/components/editor/QuickOpen";
import { Breadcrumbs } from "@/components/editor/Breadcrumbs";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { UserList } from "@/components/presence/UserList";
import {
  UserNamePrompt,
  getStoredUserName,
} from "@/components/presence/UserNamePrompt";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CommentGutter, useCommentLines } from "@/components/comments/CommentGutter";
import { HistoryPanel } from "@/components/history/HistoryPanel";
import { GitPanel } from "@/components/git/GitPanel";
import { ProblemsPanel, type ProblemEntry } from "@/components/editor/ProblemsPanel";
import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { useYjsConnection } from "@/hooks/useYjsConnection";
import { useAwareness } from "@/hooks/useAwareness";
import { useSettings } from "@/hooks/useSettings";
import { useSession } from "@/hooks/useSession";
import {
  fetchProjectTree,
  getApiBase,
  uploadFiles,
  executeTerminalCommand,
  scanWorkspace,
  createProject,
} from "@/lib/api";
import type { TreeNode, ProjectTree } from "@/lib/api";
import type { EditorSettings } from "@/hooks/useSettings";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import type { ProjectTemplate } from "@/lib/templates";
import { SetupProgress } from "@/components/templates/SetupProgress";
import { useSearchParams, useRouter } from "next/navigation";

const COLORS = [
  "#e06c75",
  "#61afef",
  "#98c379",
  "#e5c07b",
  "#c678dd",
  "#56b6c2",
  "#d19a66",
  "#be5046",
];

function pickColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function inferLanguage(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript",
    py: "python", rs: "rust", go: "go", java: "java",
    css: "css", html: "html", json: "json", md: "markdown",
    yml: "yaml", yaml: "yaml",
  };
  return map[ext ?? ""] ?? "plaintext";
}

interface CursorPosition {
  readonly line: number;
  readonly column: number;
}

type SidebarMode = "explorer" | "search" | "git";

function EditorPanel({
  projectId,
  filePath,
  userName,
  onCursorChange,
  onMarkersChange,
  settings,
}: {
  projectId: string;
  filePath: string;
  userName: string;
  onCursorChange?: (line: number, column: number) => void;
  onMarkersChange?: (markers: readonly ProblemEntry[]) => void;
  settings?: EditorSettings;
}) {
  const roomId = `${projectId}::${filePath}`;
  const connection = useYjsConnection(roomId);
  const users = useAwareness(connection?.provider ?? null, userName);
  const fileName = filePath.split("/").pop() ?? filePath;
  const commentLines = useCommentLines(connection?.doc ?? null);
  const [glyphClickLine, setGlyphClickLine] = useState<number | null>(null);
  const isMarkdown = fileName.endsWith(".md");
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  const userColor = userName ? pickColor(userName) : "#808080";

  const handleGlyphClick = useCallback((line: number) => {
    setGlyphClickLine(line);
  }, []);

  const handleClearGlyphClick = useCallback(() => {
    setGlyphClickLine(null);
  }, []);

  const markdownContent = connection
    ? connection.doc.getText("content").toString()
    : "";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Editor toolbar */}
      <div
        style={{
          padding: "6px 16px",
          backgroundColor: "#1e1e1e",
          borderBottom: "1px solid #404040",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#d4d4d4" }}>{filePath}</span>
          {isMarkdown && (
            <button
              onClick={() => setShowMarkdownPreview((prev) => !prev)}
              style={{
                padding: "2px 8px",
                fontSize: 11,
                backgroundColor: showMarkdownPreview ? "#0e639c" : "#2d2d2d",
                color: "#d4d4d4",
                border: "1px solid #555",
                borderRadius: 3,
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {showMarkdownPreview ? "Editor" : "Preview"}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <UserList users={users} />
          {connection && <ConnectionStatus status={connection.status} />}
        </div>
      </div>
      {/* Editor + Comment overlay */}
      <div style={{ flex: 1, position: "relative" }}>
        {connection ? (
          <>
            {isMarkdown && showMarkdownPreview ? (
              <MarkdownPreview markdown={markdownContent} />
            ) : (
              <CollaborativeEditor
                ytext={connection.ytext}
                provider={connection.provider}
                language={inferLanguage(fileName)}
                onCursorChange={onCursorChange}
                commentLines={commentLines}
                onGlyphClick={handleGlyphClick}
                onMarkersChange={onMarkersChange}
                settings={settings}
              />
            )}
            {/* Comment thread panel (floating over the editor) */}
            {glyphClickLine !== null && !showMarkdownPreview && (
              <div
                style={{
                  position: "absolute",
                  top: 40,
                  right: 16,
                  zIndex: 100,
                }}
              >
                <CommentGutter
                  doc={connection.doc}
                  userName={userName}
                  userColor={userColor}
                  glyphClickLine={glyphClickLine}
                  onClearGlyphClick={handleClearGlyphClick}
                />
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: "100%", backgroundColor: "#1e1e1e", color: "#808080",
            }}
          >
            Connecting...
          </div>
        )}
      </div>
    </div>
  );
}

function EditorPaneContent({
  projectId,
  activeTab,
  openTabs,
  onTabSelect,
  onTabClose,
  onCursorChange,
  splitMode,
  onSplitRight,
  onUnsplit,
  isRightPane,
  userName,
  onMarkersChange,
  settings,
}: {
  projectId: string;
  activeTab: string | null;
  openTabs: readonly string[];
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
  onCursorChange: (line: number, column: number) => void;
  splitMode: boolean;
  onSplitRight?: () => void;
  onUnsplit?: () => void;
  isRightPane?: boolean;
  userName: string;
  onMarkersChange?: (markers: readonly ProblemEntry[]) => void;
  settings?: EditorSettings;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* Tab bar with split controls */}
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TabBar
            openTabs={openTabs}
            activeTab={activeTab}
            onTabSelect={onTabSelect}
            onTabClose={onTabClose}
          />
        </div>
        {/* Split/Unsplit button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "#252526",
            borderBottom: "1px solid #404040",
            padding: "0 4px",
            height: openTabs.length > 0 ? 35 : 0,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {!splitMode && onSplitRight && openTabs.length > 0 && (
            <button
              onClick={onSplitRight}
              title="Split Right"
              style={{
                background: "none",
                border: "none",
                color: "#808080",
                cursor: "pointer",
                fontSize: 14,
                padding: "2px 6px",
                fontFamily: "system-ui, sans-serif",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#d4d4d4";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#808080";
              }}
            >
              &#x2502;&#x2502;
            </button>
          )}
          {isRightPane && onUnsplit && (
            <button
              onClick={onUnsplit}
              title="Close Split"
              style={{
                background: "none",
                border: "none",
                color: "#808080",
                cursor: "pointer",
                fontSize: 16,
                padding: "2px 6px",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#d4d4d4";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#808080";
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumbs */}
      {activeTab && (
        <Breadcrumbs filePath={activeTab} projectId={projectId} />
      )}

      {/* Editor */}
      {activeTab ? (
        <EditorPanel
          key={activeTab}
          projectId={projectId}
          filePath={activeTab}
          userName={userName}
          onCursorChange={onCursorChange}
          onMarkersChange={onMarkersChange}
          settings={settings}
        />
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#808080",
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
          }}
        >
          Select a file to start editing
        </div>
      )}
    </div>
  );
}

interface SetupStepState {
  readonly label: string;
  readonly status: "pending" | "running" | "done" | "error";
  readonly error?: string;
}

function useTemplateSetup(
  decodedProjectId: string,
  tree: TreeNode[],
  onTreeUpdate: (tree: ProjectTree) => void,
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = searchParams.get("template");

  const [setupTemplate, setSetupTemplate] = useState<ProjectTemplate | null>(null);
  const [setupSteps, setSetupSteps] = useState<readonly SetupStepState[]>([]);
  const [setupDone, setSetupDone] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupStarted, setSetupStarted] = useState(false);

  useEffect(() => {
    if (!templateId || setupStarted) return;

    const template = PROJECT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    // Only run setup for non-empty trees skip
    setSetupStarted(true);
    setSetupTemplate(template);

    const runSetup = async () => {
      try {
        // Ensure the project exists
        await createProject(decodedProjectId);

        if (template.files && template.files.length > 0) {
          // File-based template
          const steps: SetupStepState[] = [
            { label: "Creating files...", status: "running" },
          ];
          setSetupSteps(steps);

          await uploadFiles(decodedProjectId, template.files);
          setSetupSteps([{ label: "Creating files...", status: "done" }]);

          const updatedTree = await fetchProjectTree(decodedProjectId);
          onTreeUpdate(updatedTree);
          setSetupDone(true);
        } else if (template.commands && template.commands.length > 0) {
          // Command-based template
          const initialSteps: SetupStepState[] = template.commands.map(
            (cmd, i) => ({
              label: i === 0 ? "Installing dependencies..." : `Running: ${cmd.substring(0, 60)}...`,
              status: "pending" as const,
            }),
          );
          const scanStep: SetupStepState = {
            label: "Scanning project files...",
            status: "pending",
          };
          setSetupSteps([...initialSteps, scanStep]);

          // Execute commands sequentially
          for (let i = 0; i < template.commands.length; i++) {
            const cmd = template.commands[i];
            setSetupSteps((prev) =>
              prev.map((s, idx) =>
                idx === i ? { ...s, status: "running" } : s,
              ),
            );

            const result = await executeTerminalCommand(decodedProjectId, cmd);

            if (result.exitCode !== 0) {
              const errorMsg = result.stderr || "Command failed";
              setSetupSteps((prev) =>
                prev.map((s, idx) =>
                  idx === i
                    ? { ...s, status: "error", error: errorMsg }
                    : s,
                ),
              );
              setSetupError(`Command failed: ${cmd}`);
              return;
            }

            setSetupSteps((prev) =>
              prev.map((s, idx) =>
                idx === i ? { ...s, status: "done" } : s,
              ),
            );
          }

          // Scan workspace
          const scanIdx = template.commands.length;
          setSetupSteps((prev) =>
            prev.map((s, idx) =>
              idx === scanIdx ? { ...s, status: "running" } : s,
            ),
          );

          const scannedTree = await scanWorkspace(decodedProjectId);
          onTreeUpdate(scannedTree);

          setSetupSteps((prev) =>
            prev.map((s, idx) =>
              idx === scanIdx ? { ...s, status: "done" } : s,
            ),
          );
          setSetupDone(true);
        } else {
          // Empty template with no files/commands
          setSetupDone(true);
        }
      } catch (err) {
        setSetupError(
          err instanceof Error ? err.message : "Setup failed",
        );
      }
    };

    runSetup();
  }, [templateId, setupStarted, decodedProjectId, onTreeUpdate]);

  const dismissSetup = useCallback(() => {
    setSetupTemplate(null);
    // Remove template param from URL
    router.replace(`/project/${encodeURIComponent(decodedProjectId)}`);
  }, [router, decodedProjectId]);

  return {
    setupTemplate,
    setupSteps,
    setupDone,
    setupError,
    dismissSetup,
  };
}

export default function ProjectPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { projectId } = params;
  const decodedProjectId = decodeURIComponent(projectId);

  // Settings & session hooks
  const [editorSettings, setEditorSettings] = useSettings();
  const { session, updateSession, loaded: sessionLoaded } = useSession(decodedProjectId);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);

  // Phase B state
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("explorer");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [splitMode, setSplitMode] = useState(false);
  const [rightPaneTabs, setRightPaneTabs] = useState<string[]>([]);
  const [rightActiveTab, setRightActiveTab] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);

  // Restore session on load
  const [sessionRestored, setSessionRestored] = useState(false);
  useEffect(() => {
    if (sessionLoaded && !sessionRestored) {
      setOpenTabs(session.openTabs);
      setActiveTab(session.activeTab);
      setSidebarWidth(session.sidebarWidth);
      setTerminalOpen(session.terminalOpen);
      setTerminalHeight(session.terminalHeight);
      setSplitMode(session.splitMode);
      setSessionRestored(true);
    }
  }, [sessionLoaded, sessionRestored, session]);

  // Auto-save session whenever relevant state changes
  useEffect(() => {
    if (!sessionRestored) return;
    updateSession({
      openTabs,
      activeTab,
      sidebarWidth,
      terminalOpen,
      terminalHeight,
      splitMode,
    });
  }, [openTabs, activeTab, sidebarWidth, terminalOpen, terminalHeight, splitMode, sessionRestored, updateSession]);

  // Phase C state
  const [userName, setUserName] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Phase D state
  const [problems, setProblems] = useState<readonly ProblemEntry[]>([]);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [problemsHeight, setProblemsHeight] = useState(150);
  const [diffModal, setDiffModal] = useState<{
    filePath: string;
    diff: string;
  } | null>(null);

  const handleMarkersChange = useCallback(
    (markers: readonly ProblemEntry[]) => {
      setProblems(markers);
    },
    [],
  );

  const handleShowDiff = useCallback(
    (filePath: string, diff: string) => {
      setDiffModal({ filePath, diff });
    },
    [],
  );

  const handleProblemsResize = useCallback((newHeight: number) => {
    setProblemsHeight(newHeight);
  }, []);

  // Check localStorage for username on mount
  useEffect(() => {
    const stored = getStoredUserName();
    if (stored) {
      setUserName(stored);
    }
  }, []);

  const userColor = userName ? pickColor(userName) : "#808080";

  // Load project tree + poll every 2s for changes from other users
  useEffect(() => {
    let cancelled = false;

    const poll = () => {
      fetchProjectTree(decodedProjectId)
        .then((data) => {
          if (!cancelled) setTree(data.tree);
        })
        .catch(console.error);
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [decodedProjectId]);

  const handleTreeUpdate = useCallback((updated: ProjectTree) => {
    setTree(updated.tree);
  }, []);

  // Template setup
  const {
    setupTemplate,
    setupSteps,
    setupDone,
    setupError,
    dismissSetup,
  } = useTemplateSetup(decodedProjectId, tree, handleTreeUpdate);

  const handleFileSelect = useCallback((path: string) => {
    setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveTab(path);
    setCursorPosition(null);
  }, []);

  const handleTabClose = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const updated = prev.filter((t) => t !== path);
      setActiveTab((currentActive) => {
        if (currentActive !== path) return currentActive;
        if (updated.length === 0) return null;
        const oldIndex = prev.indexOf(path);
        const newIndex = Math.min(oldIndex, updated.length - 1);
        return updated[newIndex];
      });
      return updated;
    });
  }, []);

  const handleRightTabSelect = useCallback((path: string) => {
    setRightPaneTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setRightActiveTab(path);
  }, []);

  const handleRightTabClose = useCallback((path: string) => {
    setRightPaneTabs((prev) => {
      const updated = prev.filter((t) => t !== path);
      setRightActiveTab((currentActive) => {
        if (currentActive !== path) return currentActive;
        if (updated.length === 0) return null;
        const oldIndex = prev.indexOf(path);
        const newIndex = Math.min(oldIndex, updated.length - 1);
        return updated[newIndex];
      });
      return updated;
    });
  }, []);

  const handleDeleteFile = useCallback((path: string) => {
    // Close tab if the deleted file (or any file under a deleted folder) is open
    setOpenTabs((prev) => {
      const updated = prev.filter(
        (t) => t !== path && !t.startsWith(path + "/"),
      );
      setActiveTab((currentActive) => {
        if (!currentActive) return null;
        if (currentActive === path || currentActive.startsWith(path + "/")) {
          if (updated.length === 0) return null;
          return updated[0];
        }
        return currentActive;
      });
      return updated;
    });
    // Also close in right pane
    setRightPaneTabs((prev) => {
      const updated = prev.filter(
        (t) => t !== path && !t.startsWith(path + "/"),
      );
      setRightActiveTab((currentActive) => {
        if (!currentActive) return null;
        if (currentActive === path || currentActive.startsWith(path + "/")) {
          if (updated.length === 0) return null;
          return updated[0];
        }
        return currentActive;
      });
      return updated;
    });
  }, []);

  const handleCursorChange = useCallback((line: number, column: number) => {
    setCursorPosition({ line, column });
  }, []);

  const handleSplitRight = useCallback(() => {
    setSplitMode(true);
    // If there's an active tab, also open it in the right pane
    if (activeTab) {
      setRightPaneTabs((prev) =>
        prev.includes(activeTab) ? prev : [...prev, activeTab],
      );
      setRightActiveTab(activeTab);
    }
  }, [activeTab]);

  const handleUnsplit = useCallback(() => {
    setSplitMode(false);
    setRightPaneTabs([]);
    setRightActiveTab(null);
  }, []);

  const handleSearchResultSelect = useCallback(
    (filePath: string, _line: number) => {
      handleFileSelect(filePath);
      setSidebarMode("explorer");
      // Note: line positioning would require Monaco API integration
      // which would need ref forwarding through EditorPanel
    },
    [handleFileSelect],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "s") {
        e.preventDefault();
      }

      if (mod && e.key === "w") {
        e.preventDefault();
        setActiveTab((current) => {
          if (current) {
            handleTabClose(current);
          }
          return current;
        });
      }

      if (mod && e.key === "p") {
        e.preventDefault();
        setQuickOpenVisible(true);
      }

      if (mod && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setSidebarMode((prev) => (prev === "search" ? "explorer" : "search"));
      }

      if (mod && e.shiftKey && e.key === "G") {
        e.preventDefault();
        setSidebarMode((prev) => (prev === "git" ? "explorer" : "git"));
      }

      if (mod && e.shiftKey && e.key === "M") {
        e.preventDefault();
        setProblemsOpen((prev) => !prev);
      }

      if (e.key === "`" && mod) {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTabClose]);

  const previewUrl = previewFile
    ? `${getApiBase()}/preview/${encodeURIComponent(decodedProjectId)}/${previewFile}`
    : null;

  const handleOpenPreview = useCallback(() => {
    const findHtml = (nodes: TreeNode[], prefix: string): string | null => {
      for (const n of nodes) {
        const path = prefix ? `${prefix}/${n.name}` : n.name;
        if (n.type === "file" && n.name.endsWith(".html")) return path;
        if (n.type === "folder") {
          const found = findHtml(n.children, path);
          if (found) return found;
        }
      }
      return null;
    };

    if (activeTab?.endsWith(".html")) {
      setPreviewFile(activeTab);
    } else {
      const html = findHtml(tree, "");
      setPreviewFile(html);
    }
    setPreviewOpen(true);
  }, [activeTab, tree]);

  const handleTerminalResize = useCallback((newHeight: number) => {
    setTerminalHeight(newHeight);
  }, []);

  const activeFileName = activeTab?.split("/").pop() ?? "";
  const activeLanguage = activeTab ? inferLanguage(activeFileName) : "plaintext";

  // Show username prompt if no name is stored
  if (userName === null) {
    return (
      <div style={{ height: "100vh", backgroundColor: "#1e1e1e" }}>
        <UserNamePrompt onSubmit={setUserName} />
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#1e1e1e" }}>
      {/* Top bar */}
      <div
        style={{
          height: 36,
          backgroundColor: "#333333",
          borderBottom: "1px solid #404040",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          flexShrink: 0,
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
        }}
      >
        <span style={{ color: "#d4d4d4", fontWeight: 500 }}>{decodedProjectId}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Terminal toggle button */}
          <button
            onClick={() => setTerminalOpen((prev) => !prev)}
            title="Toggle Terminal (Ctrl+`)"
            style={{
              padding: "3px 10px",
              fontSize: 12,
              backgroundColor: terminalOpen ? "#0e639c" : "#2d2d2d",
              color: "#d4d4d4",
              border: "1px solid #555",
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Terminal
          </button>
          {/* Chat toggle button */}
          <button
            onClick={() => setChatOpen((prev) => !prev)}
            title="Toggle Chat"
            style={{
              padding: "3px 10px",
              fontSize: 12,
              backgroundColor: chatOpen ? "#0e639c" : "#2d2d2d",
              color: "#d4d4d4",
              border: "1px solid #555",
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Chat
          </button>
          {/* History toggle button */}
          <button
            onClick={() => setHistoryOpen((prev) => !prev)}
            title="Toggle History"
            style={{
              padding: "3px 10px",
              fontSize: 12,
              backgroundColor: historyOpen ? "#0e639c" : "#2d2d2d",
              color: "#d4d4d4",
              border: "1px solid #555",
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            History
          </button>
          {previewOpen && previewUrl && (
            <button
              onClick={() => window.open(previewUrl, "_blank")}
              title="Open in new tab"
              style={{
                padding: "3px 10px",
                fontSize: 12,
                backgroundColor: "transparent",
                color: "#808080",
                border: "1px solid #555",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Open in tab
            </button>
          )}
          <button
            onClick={() => {
              if (previewOpen) {
                setPreviewOpen(false);
              } else {
                handleOpenPreview();
              }
            }}
            style={{
              padding: "3px 12px",
              fontSize: 12,
              backgroundColor: previewOpen ? "#0e639c" : "#2d2d2d",
              color: "#d4d4d4",
              border: "1px solid #555",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            {previewOpen ? "Close Preview" : "Live Preview"}
          </button>
          {/* Download ZIP button */}
          <a
            href={`${getApiBase()}/api/download/${encodeURIComponent(decodedProjectId)}`}
            download
            style={{
              padding: "3px 10px",
              fontSize: 12,
              backgroundColor: "#2d2d2d",
              color: "#d4d4d4",
              border: "1px solid #555",
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Download ZIP
          </a>
          {/* Settings gear button */}
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            style={{
              padding: "3px 10px",
              fontSize: 14,
              backgroundColor: settingsOpen ? "#0e639c" : "#2d2d2d",
              color: "#d4d4d4",
              border: "1px solid #555",
              borderRadius: 3,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            &#x2699;
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Activity bar + Sidebar */}
        <div style={{ display: "flex", height: "100%", flexShrink: 0 }}>
          {/* Activity bar icons */}
          <div
            style={{
              width: 48,
              backgroundColor: "#333333",
              borderRight: "1px solid #404040",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 4,
              gap: 2,
              flexShrink: 0,
            }}
          >
            {/* Explorer icon */}
            <button
              onClick={() => setSidebarMode("explorer")}
              title="Explorer (Ctrl+Shift+E)"
              style={{
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                borderLeft: sidebarMode === "explorer" ? "2px solid #d4d4d4" : "2px solid transparent",
                color: sidebarMode === "explorer" ? "#d4d4d4" : "#808080",
                cursor: "pointer",
                fontSize: 18,
              }}
              onMouseEnter={(e) => {
                if (sidebarMode !== "explorer") e.currentTarget.style.color = "#d4d4d4";
              }}
              onMouseLeave={(e) => {
                if (sidebarMode !== "explorer") e.currentTarget.style.color = "#808080";
              }}
            >
              &#x1F4C1;
            </button>
            {/* Search icon */}
            <button
              onClick={() => setSidebarMode("search")}
              title="Search (Ctrl+Shift+F)"
              style={{
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                borderLeft: sidebarMode === "search" ? "2px solid #d4d4d4" : "2px solid transparent",
                color: sidebarMode === "search" ? "#d4d4d4" : "#808080",
                cursor: "pointer",
                fontSize: 18,
              }}
              onMouseEnter={(e) => {
                if (sidebarMode !== "search") e.currentTarget.style.color = "#d4d4d4";
              }}
              onMouseLeave={(e) => {
                if (sidebarMode !== "search") e.currentTarget.style.color = "#808080";
              }}
            >
              &#x1F50D;
            </button>
            {/* Git icon */}
            <button
              onClick={() => setSidebarMode("git")}
              title="Source Control (Ctrl+Shift+G)"
              style={{
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                borderLeft: sidebarMode === "git" ? "2px solid #d4d4d4" : "2px solid transparent",
                color: sidebarMode === "git" ? "#d4d4d4" : "#808080",
                cursor: "pointer",
                fontSize: 18,
              }}
              onMouseEnter={(e) => {
                if (sidebarMode !== "git") e.currentTarget.style.color = "#d4d4d4";
              }}
              onMouseLeave={(e) => {
                if (sidebarMode !== "git") e.currentTarget.style.color = "#808080";
              }}
            >
              &#x2387;
            </button>
          </div>
          {/* Sidebar content */}
          <div style={{ width: sidebarWidth, flexShrink: 0, height: "100%" }}>
            {sidebarMode === "explorer" && (
              <FileExplorer
                projectId={decodedProjectId}
                tree={tree}
                activeFile={activeTab}
                onFileSelect={handleFileSelect}
                onTreeUpdate={handleTreeUpdate}
                onDeleteFile={handleDeleteFile}
              />
            )}
            {sidebarMode === "search" && (
              <GlobalSearch
                projectId={decodedProjectId}
                onResultSelect={handleSearchResultSelect}
                onBack={() => setSidebarMode("explorer")}
              />
            )}
            {sidebarMode === "git" && (
              <GitPanel
                projectId={decodedProjectId}
                onBack={() => setSidebarMode("explorer")}
                onShowDiff={handleShowDiff}
              />
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div
          style={{
            width: 4,
            cursor: "col-resize",
            backgroundColor: "transparent",
            flexShrink: 0,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = sidebarWidth;
            const onMove = (ev: MouseEvent) => {
              const newWidth = Math.max(180, Math.min(500, startWidth + ev.clientX - startX));
              setSidebarWidth(newWidth);
            };
            const onUp = () => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
        />

        {/* Editor area (with optional terminal below) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Editor pane(s) */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
            {/* Left editor pane */}
            <EditorPaneContent
              projectId={decodedProjectId}
              activeTab={activeTab}
              openTabs={openTabs}
              onTabSelect={handleFileSelect}
              onTabClose={handleTabClose}
              onCursorChange={handleCursorChange}
              splitMode={splitMode}
              onSplitRight={handleSplitRight}
              userName={userName}
              onMarkersChange={handleMarkersChange}
              settings={editorSettings}
            />

            {/* Split divider + right pane */}
            {splitMode && (
              <>
                {/* Split resize handle */}
                <div
                  style={{
                    width: 4,
                    cursor: "col-resize",
                    backgroundColor: "transparent",
                    flexShrink: 0,
                    borderLeft: "1px solid #404040",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const container = e.currentTarget.parentElement;
                    if (!container) return;
                    const containerWidth = container.getBoundingClientRect().width;
                    const startRatio = splitRatio;
                    const onMove = (ev: MouseEvent) => {
                      const delta = ev.clientX - startX;
                      const newRatio = Math.max(
                        0.2,
                        Math.min(0.8, startRatio + delta / containerWidth),
                      );
                      setSplitRatio(newRatio);
                    };
                    const onUp = () => {
                      document.removeEventListener("mousemove", onMove);
                      document.removeEventListener("mouseup", onUp);
                    };
                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp);
                  }}
                />

                {/* Right editor pane */}
                <EditorPaneContent
                  projectId={decodedProjectId}
                  activeTab={rightActiveTab}
                  openTabs={rightPaneTabs}
                  onTabSelect={handleRightTabSelect}
                  onTabClose={handleRightTabClose}
                  onCursorChange={handleCursorChange}
                  splitMode={splitMode}
                  onUnsplit={handleUnsplit}
                  isRightPane
                  userName={userName}
                  onMarkersChange={handleMarkersChange}
                  settings={editorSettings}
                />
              </>
            )}
          </div>

          {/* Terminal panel */}
          {terminalOpen && (
            <TerminalPanel
              projectId={decodedProjectId}
              height={terminalHeight}
              onResize={handleTerminalResize}
            />
          )}

          {/* Problems panel */}
          {problemsOpen && (
            <ProblemsPanel
              problems={problems}
              filePath={activeTab}
              onProblemClick={(line, _col) => {
                // Scroll to line - would need editor ref forwarding
                // For now just display the information
                void line;
              }}
              onClose={() => setProblemsOpen(false)}
              height={problemsHeight}
              onResize={handleProblemsResize}
            />
          )}
        </div>

        {/* Preview panel */}
        {previewOpen && previewUrl && (
          <>
            <div
              style={{
                width: 4,
                cursor: "col-resize",
                backgroundColor: "transparent",
                flexShrink: 0,
              }}
            />
            <div
              style={{
                width: "40%",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                borderLeft: "1px solid #404040",
              }}
            >
              <div
                style={{
                  height: 32,
                  backgroundColor: "#252526",
                  borderBottom: "1px solid #404040",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 12px",
                  fontSize: 12,
                  color: "#808080",
                  fontFamily: "system-ui, sans-serif",
                  gap: 8,
                }}
              >
                <span>Preview: {previewFile}</span>
              </div>
              <iframe
                key={previewUrl}
                src={previewUrl}
                style={{
                  flex: 1,
                  border: "none",
                  backgroundColor: "white",
                }}
                title="Live Preview"
              />
            </div>
          </>
        )}

        {/* History panel */}
        {historyOpen && (
          <HistoryPanel
            projectId={decodedProjectId}
            filePath={activeTab}
            onClose={() => setHistoryOpen(false)}
          />
        )}

        {/* Chat panel */}
        {chatOpen && (
          <ChatPanel
            projectId={decodedProjectId}
            userName={userName}
            userColor={userColor}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>

      {/* Status bar */}
      <StatusBar
        language={activeLanguage}
        cursorPosition={cursorPosition}
      />

      {/* Quick Open modal */}
      {quickOpenVisible && (
        <QuickOpen
          tree={tree}
          onSelect={handleFileSelect}
          onClose={() => setQuickOpenVisible(false)}
        />
      )}

      {/* Settings panel */}
      {settingsOpen && (
        <SettingsPanel
          settings={editorSettings}
          onSettingsChange={setEditorSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Template setup progress */}
      {setupTemplate && (
        <SetupProgress
          template={setupTemplate}
          steps={setupSteps}
          done={setupDone}
          error={setupError}
          onOpen={dismissSetup}
        />
      )}

      {/* Diff modal overlay */}
      {diffModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setDiffModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "80%",
              maxWidth: 900,
              maxHeight: "80vh",
              backgroundColor: "#1e1e1e",
              border: "1px solid #404040",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Diff header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 16px",
                backgroundColor: "#252526",
                borderBottom: "1px solid #404040",
                fontFamily: "system-ui, sans-serif",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#d4d4d4" }}>
                Diff: {diffModal.filePath}
              </span>
              <button
                onClick={() => setDiffModal(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#808080",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#d4d4d4";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#808080";
                }}
              >
                &#x00D7;
              </button>
            </div>
            {/* Diff content */}
            <pre
              style={{
                flex: 1,
                overflowY: "auto",
                margin: 0,
                padding: 16,
                fontFamily:
                  "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
                fontSize: 12,
                lineHeight: "18px",
                color: "#d4d4d4",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {diffModal.diff
                ? diffModal.diff.split("\n").map((line, i) => {
                    let color = "#d4d4d4";
                    let bg = "transparent";
                    if (line.startsWith("+") && !line.startsWith("+++")) {
                      color = "#73c991";
                      bg = "#1d3a28";
                    } else if (
                      line.startsWith("-") &&
                      !line.startsWith("---")
                    ) {
                      color = "#f48771";
                      bg = "#5a1d1d";
                    } else if (line.startsWith("@@")) {
                      color = "#75beff";
                    }
                    return (
                      <div
                        key={i}
                        style={{ color, backgroundColor: bg, padding: "0 4px" }}
                      >
                        {line || " "}
                      </div>
                    );
                  })
                : "No changes detected."}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
