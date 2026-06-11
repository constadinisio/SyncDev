"use client";

import { useState, useEffect, useCallback } from "react";
import { FileExplorer } from "@/components/explorer/FileExplorer";
import { CollaborativeEditor } from "@/components/editor/LazyCollaborativeEditor";
import { ImagePreview } from "@/components/editor/ImagePreview";
import { BinaryPreview } from "@/components/editor/BinaryPreview";
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
  isImageExtension,
  isBinaryExtension,
} from "@/lib/api";
import type { TreeNode, ProjectTree } from "@/lib/api";
import type { EditorSettings } from "@/hooks/useSettings";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import type { ProjectTemplate } from "@/lib/templates";
import { SetupProgress } from "@/components/templates/SetupProgress";
import { KeyboardShortcuts } from "@/components/editor/KeyboardShortcuts";
import { DiffViewer } from "@/components/editor/DiffViewer";
import { useTheme } from "@/hooks/useTheme";
import { useProjectPresence, type UserPresence } from "@/hooks/useProjectPresence";
import { FollowBar } from "@/components/presence/FollowBar";
import { useSearchParams, useRouter } from "next/navigation";

const COLORS = [
  "#f87171", "#60a5fa", "#4ade80", "#facc15",
  "#a78bfa", "#22d3ee", "#fb923c", "#f472b6",
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
  const fileName = filePath.split("/").pop() ?? filePath;
  const isImage = isImageExtension(fileName);
  const isBinary = isBinaryExtension(fileName);

  const roomId = `${projectId}::${filePath}`;
  const connection = useYjsConnection(roomId);
  const users = useAwareness(connection?.provider ?? null, userName);
  const commentLines = useCommentLines(connection?.doc ?? null);
  const [glyphClickLine, setGlyphClickLine] = useState<number | null>(null);
  const isMarkdown = fileName.endsWith(".md");
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  // For binary/image files, show preview instead of editor
  if (isImage) {
    return <ImagePreview projectId={projectId} filePath={filePath} fileName={fileName} />;
  }
  if (isBinary) {
    return <BinaryPreview projectId={projectId} filePath={filePath} fileName={fileName} />;
  }

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
    <div className="flex-1 flex flex-col">
      {/* Editor toolbar */}
      <div className="px-4 py-1.5 bg-surface-100 border-b border-surface-300/40 flex justify-between items-center font-sans text-[13px]">
        <div className="flex items-center gap-2">
          <span className="text-surface-800 font-medium">{filePath}</span>
          {isMarkdown && (
            <button
              onClick={() => setShowMarkdownPreview((prev) => !prev)}
              className={`px-2.5 py-0.5 text-[11px] rounded-md border cursor-pointer transition-colors duration-100
                ${showMarkdownPreview
                  ? "bg-brand-600 text-white border-brand-500"
                  : "bg-surface-200 text-surface-700 border-surface-300/60 hover:bg-surface-300"
                }`}
            >
              {showMarkdownPreview ? "Editor" : "Preview"}
            </button>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <UserList users={users} />
          {connection && <ConnectionStatus status={connection.status} />}
        </div>
      </div>
      {/* Editor + Comment overlay */}
      <div className="flex-1 relative">
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
            {glyphClickLine !== null && !showMarkdownPreview && (
              <div className="absolute top-10 right-4 z-[100]">
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
          <div className="flex items-center justify-center h-full bg-surface-100 text-surface-500">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Connecting...
            </div>
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
  onTabReorder,
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
  onTabReorder?: (from: number, to: number) => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Tab bar with split controls */}
      <div className="flex items-center shrink-0">
        <div className="flex-1 min-w-0">
          <TabBar
            openTabs={openTabs}
            activeTab={activeTab}
            onTabSelect={onTabSelect}
            onTabClose={onTabClose}
            onTabReorder={onTabReorder}
          />
        </div>
        {/* Split/Unsplit button */}
        {openTabs.length > 0 && (
          <div className="flex items-center bg-surface-150 border-b border-surface-300/60 px-1 h-[37px] shrink-0">
            {!splitMode && onSplitRight && (
              <button
                onClick={onSplitRight}
                title="Split Right"
                className="bg-transparent border-none text-surface-500 hover:text-surface-800
                  cursor-pointer p-1 rounded transition-colors duration-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="12" y1="3" x2="12" y2="21"/>
                </svg>
              </button>
            )}
            {isRightPane && onUnsplit && (
              <button
                onClick={onUnsplit}
                title="Close Split"
                className="bg-transparent border-none text-surface-500 hover:text-surface-800
                  cursor-pointer p-1 rounded transition-colors duration-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        )}
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
        <div className="flex-1 flex flex-col items-center justify-center text-surface-500 font-sans text-sm gap-3 bg-surface-100">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-surface-300">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span>Select a file to start editing</span>
          <span className="text-xs text-surface-400">Ctrl+P to quick open</span>
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

    setSetupStarted(true);
    setSetupTemplate(template);

    const runSetup = async () => {
      try {
        await createProject(decodedProjectId);

        if (template.files && template.files.length > 0) {
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

// Activity bar icon component
function ActivityBarIcon({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-10 h-10 flex items-center justify-center border-none cursor-pointer rounded-lg
        transition-all duration-100
        ${active
          ? "bg-surface-300/50 text-surface-900 border-l-2 border-l-brand-500"
          : "bg-transparent text-surface-500 hover:text-surface-800 hover:bg-surface-300/30"
        }`}
    >
      {children}
    </button>
  );
}

// Toolbar button component
function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer
        transition-all duration-100
        ${active
          ? "bg-brand-600 text-white border-brand-500 shadow-sm shadow-brand-600/20"
          : "bg-surface-200 text-surface-700 border-surface-300/60 hover:bg-surface-300 hover:text-surface-800"
        }`}
    >
      {children}
    </button>
  );
}

export default function ProjectPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { projectId } = params;
  const decodedProjectId = decodeURIComponent(projectId);

  const [editorSettings, setEditorSettings] = useSettings();
  const { session, updateSession, loaded: sessionLoaded } = useSession(decodedProjectId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);

  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("explorer");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [splitMode, setSplitMode] = useState(false);
  const [rightPaneTabs, setRightPaneTabs] = useState<string[]>([]);
  const [rightActiveTab, setRightActiveTab] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);

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

  const [userName, setUserName] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [problems, setProblems] = useState<readonly ProblemEntry[]>([]);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [problemsHeight, setProblemsHeight] = useState(150);
  const [diffModal, setDiffModal] = useState<{
    filePath: string;
    original: string;
    modified: string;
  } | null>(null);

  const handleMarkersChange = useCallback(
    (markers: readonly ProblemEntry[]) => {
      setProblems(markers);
    },
    [],
  );

  const handleShowDiff = useCallback(
    async (filePath: string, _diff: string) => {
      const { gitShowFile } = await import("@/lib/git-api");
      const original = await gitShowFile(decodedProjectId, filePath).catch(() => "");
      // Get the working tree content via terminal cat
      const result = await executeTerminalCommand(decodedProjectId, `cat "${filePath}"`).catch(() => ({ stdout: "", stderr: "", exitCode: 1 }));
      const modified = result.stdout;
      setDiffModal({ filePath, original, modified });
    },
    [decodedProjectId],
  );

  const handleProblemsResize = useCallback((newHeight: number) => {
    setProblemsHeight(newHeight);
  }, []);

  useEffect(() => {
    const stored = getStoredUserName();
    if (stored) {
      setUserName(stored);
    }
  }, []);

  const userColor = userName ? pickColor(userName) : "#808080";
  const cursorLine = cursorPosition?.line ?? null;
  const otherUsers = useProjectPresence(decodedProjectId, userName, userColor, activeTab, cursorLine);
  const [followingUser, setFollowingUser] = useState<string | null>(null);

  // Follow mode: when following a user, switch to their active file
  const followedUser = followingUser
    ? otherUsers.find((u) => u.name === followingUser) ?? null
    : null;

  useEffect(() => {
    if (!followedUser?.activeFile) return;
    if (followedUser.activeFile !== activeTab) {
      handleFileSelect(followedUser.activeFile);
    }
  }, [followedUser?.activeFile]);

  useEffect(() => {
    let cancelled = false;

    // If arriving from a clone (?scan=1), trigger a workspace scan first
    const params = new URLSearchParams(window.location.search);
    const needsScan = params.get("scan") === "1";

    const init = async () => {
      if (needsScan) {
        try {
          const scanned = await scanWorkspace(decodedProjectId);
          if (!cancelled) setTree(scanned.tree);
          // Remove the scan param from URL
          window.history.replaceState({}, "", window.location.pathname);
        } catch (err) {
          console.error("Scan failed:", err);
        }
      }
    };

    const poll = () => {
      fetchProjectTree(decodedProjectId)
        .then((data) => {
          if (!cancelled) setTree(data.tree);
        })
        .catch(console.error);
    };

    init().then(poll);
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [decodedProjectId]);

  const handleTreeUpdate = useCallback((updated: ProjectTree) => {
    setTree(updated.tree);
  }, []);

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

  const handleTabReorder = useCallback((from: number, to: number) => {
    setOpenTabs((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      return updated;
    });
  }, []);

  const handleDeleteFile = useCallback((path: string) => {
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
    },
    [handleFileSelect],
  );

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

      if (e.key === "/" && mod) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
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

  const handleTerminalCommandComplete = useCallback(() => {
    // Re-fetch the tree after a terminal command to pick up file changes
    fetchProjectTree(decodedProjectId)
      .then((data) => setTree(data.tree))
      .catch(console.error);
  }, [decodedProjectId]);

  const activeFileName = activeTab?.split("/").pop() ?? "";
  const activeLanguage = activeTab ? inferLanguage(activeFileName) : "plaintext";

  if (userName === null) {
    return (
      <div className="h-screen bg-surface-0">
        <UserNamePrompt onSubmit={setUserName} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface-100">
      {/* Top bar */}
      <div className="h-10 bg-surface-0 border-b border-surface-300/40 flex items-center justify-between px-3 shrink-0 font-sans text-[13px]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <span className="text-surface-900 font-semibold">{decodedProjectId}</span>
          </div>
          {/* Online users — click to follow */}
          {otherUsers.length > 0 && (
            <div className="flex gap-1 items-center ml-4">
              {otherUsers.map((u) => (
                <button
                  key={u.name}
                  onClick={() => setFollowingUser((prev) => prev === u.name ? null : u.name)}
                  title={followingUser === u.name ? `Stop following ${u.name}` : `Follow ${u.name}`}
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium cursor-pointer
                    border transition-all duration-100
                    ${followingUser === u.name
                      ? "ring-2 ring-offset-1 ring-offset-surface-0"
                      : "hover:scale-105"
                    }`}
                  style={{
                    color: u.color,
                    backgroundColor: `${u.color}15`,
                    borderColor: `${u.color}30`,
                    ...(followingUser === u.name ? { ringColor: u.color } : {}),
                  }}
                >
                  {followingUser === u.name ? `Following ${u.name}` : u.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <ToolbarButton
            active={terminalOpen}
            onClick={() => setTerminalOpen((prev) => !prev)}
            title="Toggle Terminal (Ctrl+`)"
          >
            Terminal
          </ToolbarButton>
          <ToolbarButton
            active={chatOpen}
            onClick={() => setChatOpen((prev) => !prev)}
            title="Toggle Chat"
          >
            Chat
          </ToolbarButton>
          <ToolbarButton
            active={historyOpen}
            onClick={() => setHistoryOpen((prev) => !prev)}
            title="Toggle History"
          >
            History
          </ToolbarButton>
          {previewOpen && previewUrl && (
            <ToolbarButton onClick={() => window.open(previewUrl, "_blank")} title="Open in new tab">
              Open in tab
            </ToolbarButton>
          )}
          <ToolbarButton
            active={previewOpen}
            onClick={() => {
              if (previewOpen) {
                setPreviewOpen(false);
              } else {
                handleOpenPreview();
              }
            }}
          >
            {previewOpen ? "Close Preview" : "Live Preview"}
          </ToolbarButton>
          <a
            href={`${getApiBase()}/api/download/${encodeURIComponent(decodedProjectId)}`}
            download
            className="px-3 py-1.5 text-xs font-medium rounded-md border bg-surface-200 text-surface-700
              border-surface-300/60 hover:bg-surface-300 hover:text-surface-800 no-underline
              inline-flex items-center transition-colors duration-100 cursor-pointer"
          >
            Download
          </a>
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="p-1.5 rounded-md border bg-surface-200 text-surface-600
              border-surface-300/60 hover:bg-surface-300 hover:text-surface-800
              cursor-pointer transition-all duration-100"
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className={`p-1.5 rounded-md border cursor-pointer transition-all duration-100
              ${settingsOpen
                ? "bg-brand-600 text-white border-brand-500"
                : "bg-surface-200 text-surface-600 border-surface-300/60 hover:bg-surface-300 hover:text-surface-800"
              }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Follow bar */}
      {followedUser && (
        <FollowBar
          following={followedUser}
          onUnfollow={() => setFollowingUser(null)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity bar + Sidebar */}
        <div className="flex h-full shrink-0">
          {/* Activity bar icons */}
          <div className="w-12 bg-surface-0 border-r border-surface-300/40 flex flex-col items-center pt-1 gap-1 shrink-0">
            <ActivityBarIcon
              active={sidebarMode === "explorer"}
              onClick={() => setSidebarMode("explorer")}
              title="Explorer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </ActivityBarIcon>
            <ActivityBarIcon
              active={sidebarMode === "search"}
              onClick={() => setSidebarMode("search")}
              title="Search (Ctrl+Shift+F)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </ActivityBarIcon>
            <ActivityBarIcon
              active={sidebarMode === "git"}
              onClick={() => setSidebarMode("git")}
              title="Source Control (Ctrl+Shift+G)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
              </svg>
            </ActivityBarIcon>
          </div>
          {/* Sidebar content */}
          <div style={{ width: sidebarWidth }} className="shrink-0 h-full">
            {sidebarMode === "explorer" && (
              <FileExplorer
                projectId={decodedProjectId}
                tree={tree}
                activeFile={activeTab}
                onFileSelect={handleFileSelect}
                onTreeUpdate={handleTreeUpdate}
                onDeleteFile={handleDeleteFile}
                userPresence={otherUsers}
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
          className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-brand-500/30 transition-colors duration-150"
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

        {/* Editor area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex overflow-hidden min-h-0">
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
              onTabReorder={handleTabReorder}
            />

            {splitMode && (
              <>
                <div
                  className="w-1 cursor-col-resize bg-transparent shrink-0 border-l border-surface-300/40
                    hover:bg-brand-500/30 transition-colors duration-150"
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

          {terminalOpen && (
            <TerminalPanel
              projectId={decodedProjectId}
              height={terminalHeight}
              onResize={handleTerminalResize}
              onCommandComplete={handleTerminalCommandComplete}
            />
          )}

          {problemsOpen && (
            <ProblemsPanel
              problems={problems}
              filePath={activeTab}
              onProblemClick={(line, _col) => {
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
            <div className="w-1 cursor-col-resize bg-transparent shrink-0" />
            <div className="w-[40%] shrink-0 flex flex-col border-l border-surface-300/40">
              <div className="h-8 bg-surface-150 border-b border-surface-300/40 flex items-center px-3 text-xs text-surface-500 font-sans gap-2">
                <span>Preview: {previewFile}</span>
              </div>
              <iframe
                key={previewUrl}
                src={previewUrl}
                className="flex-1 border-none bg-white"
                title="Live Preview"
              />
            </div>
          </>
        )}

        {historyOpen && (
          <HistoryPanel
            projectId={decodedProjectId}
            filePath={activeTab}
            onClose={() => setHistoryOpen(false)}
          />
        )}

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

      {quickOpenVisible && (
        <QuickOpen
          tree={tree}
          onSelect={handleFileSelect}
          onClose={() => setQuickOpenVisible(false)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={editorSettings}
          onSettingsChange={setEditorSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {shortcutsOpen && (
        <KeyboardShortcuts onClose={() => setShortcutsOpen(false)} />
      )}

      {setupTemplate && (
        <SetupProgress
          template={setupTemplate}
          steps={setupSteps}
          done={setupDone}
          error={setupError}
          onOpen={dismissSetup}
        />
      )}

      {/* Diff modal — Monaco side-by-side diff editor */}
      {diffModal && (
        <DiffViewer
          filePath={diffModal.filePath}
          original={diffModal.original}
          modified={diffModal.modified}
          onClose={() => setDiffModal(null)}
        />
      )}
    </div>
  );
}
