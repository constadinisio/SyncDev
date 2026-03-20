"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  gitStatus,
  gitStage,
  gitUnstage,
  gitStageAll,
  gitUnstageAll,
  gitCommit,
  gitBranch,
  gitCreateBranch,
  gitPush,
  gitPull,
  gitLog,
  gitDiscard,
  gitDiff,
  gitInit,
  type GitFileChange,
  type GitLogEntry,
} from "@/lib/git-api";

interface GitPanelProps {
  readonly projectId: string;
  readonly onBack: () => void;
  readonly onShowDiff?: (filePath: string, diff: string) => void;
}

type StatusMessage = {
  readonly text: string;
  readonly type: "info" | "error" | "success";
};

const STATUS_COLORS: Record<GitFileChange["status"], string> = {
  modified: "#e2c08d",
  added: "#73c991",
  deleted: "#c74e39",
  untracked: "#73c991",
  renamed: "#73b7f2",
};

const STATUS_LETTERS: Record<GitFileChange["status"], string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  untracked: "U",
  renamed: "R",
};

function FileChangeRow({
  change,
  onStage,
  onUnstage,
  onDiscard,
  onClick,
}: {
  readonly change: GitFileChange;
  readonly onStage?: () => void;
  readonly onUnstage?: () => void;
  readonly onDiscard?: () => void;
  readonly onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const fileName = change.path.split("/").pop() ?? change.path;
  const dirPath = change.path.includes("/")
    ? change.path.substring(0, change.path.lastIndexOf("/"))
    : "";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "2px 8px 2px 20px",
        fontSize: 12,
        fontFamily: "system-ui, sans-serif",
        color: "#d4d4d4",
        cursor: "pointer",
        backgroundColor: hovered ? "#2a2d2e" : "transparent",
        gap: 4,
        minHeight: 22,
      }}
    >
      {/* File name */}
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ color: STATUS_COLORS[change.status] }}>{fileName}</span>
        {dirPath && (
          <span style={{ color: "#808080", fontSize: 11 }}>{dirPath}</span>
        )}
      </span>

      {/* Action buttons - shown on hover */}
      {hovered && (
        <span
          style={{ display: "flex", gap: 2, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {onDiscard && (
            <button
              onClick={onDiscard}
              title="Discard Changes"
              style={{
                background: "none",
                border: "none",
                color: "#808080",
                cursor: "pointer",
                fontSize: 14,
                padding: "0 3px",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#d4d4d4";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#808080";
              }}
            >
              ↺
            </button>
          )}
          {onStage && (
            <button
              onClick={onStage}
              title="Stage Changes"
              style={{
                background: "none",
                border: "none",
                color: "#808080",
                cursor: "pointer",
                fontSize: 14,
                padding: "0 3px",
                lineHeight: 1,
                fontWeight: 700,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#d4d4d4";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#808080";
              }}
            >
              +
            </button>
          )}
          {onUnstage && (
            <button
              onClick={onUnstage}
              title="Unstage Changes"
              style={{
                background: "none",
                border: "none",
                color: "#808080",
                cursor: "pointer",
                fontSize: 14,
                padding: "0 3px",
                lineHeight: 1,
                fontWeight: 700,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#d4d4d4";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#808080";
              }}
            >
              −
            </button>
          )}
        </span>
      )}

      {/* Status indicator */}
      <span
        style={{
          color: STATUS_COLORS[change.status],
          fontSize: 11,
          fontWeight: 600,
          width: 14,
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {STATUS_LETTERS[change.status]}
      </span>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  collapsed,
  onToggle,
  actions,
}: {
  readonly title: string;
  readonly count: number;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly actions?: React.ReactNode;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: "#bbbbbb",
        fontFamily: "system-ui, sans-serif",
        cursor: "pointer",
        userSelect: "none",
        backgroundColor: "#2d2d2d",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 10, width: 12, textAlign: "center" }}>
        {collapsed ? "▸" : "▾"}
      </span>
      <span>{title}</span>
      <span
        style={{
          fontSize: 10,
          color: "#808080",
          backgroundColor: "#404040",
          padding: "0 5px",
          borderRadius: 8,
          marginLeft: 4,
        }}
      >
        {count}
      </span>
      {actions && (
        <span
          style={{ marginLeft: "auto", display: "flex", gap: 2 }}
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </span>
      )}
    </div>
  );
}

function SmallButton({
  title,
  onClick,
  children,
}: {
  readonly title: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "none",
        border: "none",
        color: "#808080",
        cursor: "pointer",
        fontSize: 13,
        padding: "0 3px",
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#d4d4d4";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "#808080";
      }}
    >
      {children}
    </button>
  );
}

export function GitPanel({ projectId, onBack, onShowDiff }: GitPanelProps) {
  const [changes, setChanges] = useState<readonly GitFileChange[]>([]);
  const [branch, setBranch] = useState("");
  const [logEntries, setLogEntries] = useState<readonly GitLogEntry[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [isGitRepo, setIsGitRepo] = useState(true);

  const [stagedCollapsed, setStagedCollapsed] = useState(false);
  const [changesCollapsed, setChangesCollapsed] = useState(false);
  const [logCollapsed, setLogCollapsed] = useState(true);
  const [branchCollapsed, setBranchCollapsed] = useState(true);
  const [newBranchName, setNewBranchName] = useState("");
  const [showNewBranch, setShowNewBranch] = useState(false);

  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = useCallback(
    (text: string, type: StatusMessage["type"]) => {
      setStatusMsg({ text, type });
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setStatusMsg(null), 4000);
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResult, branchResult, logResult] = await Promise.all([
        gitStatus(projectId).catch(() => [] as readonly GitFileChange[]),
        gitBranch(projectId).catch(() => ""),
        gitLog(projectId, 10).catch(() => [] as readonly GitLogEntry[]),
      ]);
      setChanges(statusResult);
      setBranch(branchResult);
      setLogEntries(logResult);
      setIsGitRepo(branchResult !== "" || statusResult.length > 0);
    } catch {
      setIsGitRepo(false);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stagedChanges = changes.filter((c) => c.staged);
  const unstagedChanges = changes.filter((c) => !c.staged);

  const handleStage = useCallback(
    async (filePath: string) => {
      try {
        await gitStage(projectId, filePath);
        await refresh();
      } catch (err) {
        showStatus(
          err instanceof Error ? err.message : "Stage failed",
          "error",
        );
      }
    },
    [projectId, refresh, showStatus],
  );

  const handleUnstage = useCallback(
    async (filePath: string) => {
      try {
        await gitUnstage(projectId, filePath);
        await refresh();
      } catch (err) {
        showStatus(
          err instanceof Error ? err.message : "Unstage failed",
          "error",
        );
      }
    },
    [projectId, refresh, showStatus],
  );

  const handleDiscard = useCallback(
    async (filePath: string) => {
      try {
        await gitDiscard(projectId, filePath);
        await refresh();
        showStatus(`Discarded changes to ${filePath}`, "info");
      } catch (err) {
        showStatus(
          err instanceof Error ? err.message : "Discard failed",
          "error",
        );
      }
    },
    [projectId, refresh, showStatus],
  );

  const handleStageAll = useCallback(async () => {
    try {
      await gitStageAll(projectId);
      await refresh();
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Stage all failed",
        "error",
      );
    }
  }, [projectId, refresh, showStatus]);

  const handleUnstageAll = useCallback(async () => {
    try {
      await gitUnstageAll(projectId);
      await refresh();
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Unstage all failed",
        "error",
      );
    }
  }, [projectId, refresh, showStatus]);

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim()) {
      showStatus("Please enter a commit message", "error");
      return;
    }
    try {
      await gitCommit(projectId, commitMessage.trim());
      setCommitMessage("");
      await refresh();
      showStatus("Commit successful", "success");
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Commit failed",
        "error",
      );
    }
  }, [projectId, commitMessage, refresh, showStatus]);

  const handlePush = useCallback(async () => {
    try {
      const result = await gitPush(projectId);
      showStatus(result, "success");
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Push failed",
        "error",
      );
    }
  }, [projectId, showStatus]);

  const handlePull = useCallback(async () => {
    try {
      const result = await gitPull(projectId);
      showStatus(result, "success");
      await refresh();
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Pull failed",
        "error",
      );
    }
  }, [projectId, refresh, showStatus]);

  const handleCreateBranch = useCallback(async () => {
    if (!newBranchName.trim()) return;
    try {
      await gitCreateBranch(projectId, newBranchName.trim());
      setNewBranchName("");
      setShowNewBranch(false);
      await refresh();
      showStatus(`Switched to new branch '${newBranchName.trim()}'`, "success");
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Create branch failed",
        "error",
      );
    }
  }, [projectId, newBranchName, refresh, showStatus]);

  const handleInitRepo = useCallback(async () => {
    try {
      await gitInit(projectId);
      setIsGitRepo(true);
      await refresh();
      showStatus("Git repository initialized", "success");
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "git init failed",
        "error",
      );
    }
  }, [projectId, refresh, showStatus]);

  const handleFileDiff = useCallback(
    async (filePath: string) => {
      try {
        const diff = await gitDiff(projectId, filePath);
        onShowDiff?.(filePath, diff);
      } catch (err) {
        showStatus(
          err instanceof Error ? err.message : "Diff failed",
          "error",
        );
      }
    },
    [projectId, onShowDiff, showStatus],
  );

  if (!isGitRepo) {
    return (
      <div
        style={{
          height: "100%",
          backgroundColor: "#252526",
          borderRight: "1px solid #404040",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: "#bbbbbb",
            fontFamily: "system-ui, sans-serif",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Source Control</span>
          <button
            onClick={onBack}
            title="Back to Explorer"
            style={{
              background: "none",
              border: "none",
              color: "#cccccc",
              cursor: "pointer",
              fontSize: 14,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            &#x2190;
          </button>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 12,
          }}
        >
          <span
            style={{
              color: "#808080",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
              textAlign: "center",
            }}
          >
            This project is not a git repository.
          </span>
          <button
            onClick={handleInitRepo}
            style={{
              padding: "6px 16px",
              fontSize: 12,
              backgroundColor: "#0e639c",
              color: "#ffffff",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#1177bb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#0e639c";
            }}
          >
            Initialize Repository
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        backgroundColor: "#252526",
        borderRight: "1px solid #404040",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#bbbbbb",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Source Control</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <SmallButton title="Refresh" onClick={refresh}>
            &#x21BB;
          </SmallButton>
          <button
            onClick={onBack}
            title="Back to Explorer"
            style={{
              background: "none",
              border: "none",
              color: "#cccccc",
              cursor: "pointer",
              fontSize: 14,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            &#x2190;
          </button>
        </div>
      </div>

      {/* Branch info */}
      <div
        style={{
          padding: "4px 12px 8px",
          fontSize: 12,
          fontFamily: "system-ui, sans-serif",
          color: "#d4d4d4",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ color: "#808080" }}>&#x2387;</span>
        <span>{branch || "HEAD"}</span>
        {loading && (
          <span style={{ color: "#808080", fontSize: 10, marginLeft: "auto" }}>
            loading...
          </span>
        )}
      </div>

      {/* Commit input */}
      <div style={{ padding: "0 8px 8px" }}>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              handleCommit();
            }
          }}
          style={{
            width: "100%",
            padding: "4px 8px",
            fontSize: 12,
            fontFamily: "system-ui, sans-serif",
            backgroundColor: "#3c3c3c",
            color: "#d4d4d4",
            border: "1px solid #555555",
            borderRadius: 3,
            outline: "none",
            boxSizing: "border-box",
            resize: "vertical",
            minHeight: 28,
            maxHeight: 120,
            lineHeight: "18px",
          }}
          rows={1}
        />
        <button
          onClick={handleCommit}
          disabled={!commitMessage.trim() || stagedChanges.length === 0}
          style={{
            width: "100%",
            padding: "4px 0",
            marginTop: 4,
            fontSize: 12,
            fontFamily: "system-ui, sans-serif",
            backgroundColor:
              commitMessage.trim() && stagedChanges.length > 0
                ? "#0e639c"
                : "#3c3c3c",
            color:
              commitMessage.trim() && stagedChanges.length > 0
                ? "#ffffff"
                : "#808080",
            border: "none",
            borderRadius: 3,
            cursor:
              commitMessage.trim() && stagedChanges.length > 0
                ? "pointer"
                : "default",
          }}
        >
          Commit
        </button>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div
          style={{
            padding: "4px 12px",
            fontSize: 11,
            fontFamily: "system-ui, sans-serif",
            color:
              statusMsg.type === "error"
                ? "#f48771"
                : statusMsg.type === "success"
                  ? "#73c991"
                  : "#d4d4d4",
            backgroundColor:
              statusMsg.type === "error"
                ? "#5a1d1d"
                : statusMsg.type === "success"
                  ? "#1d3a28"
                  : "#2d2d2d",
            borderTop: "1px solid #404040",
            borderBottom: "1px solid #404040",
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* File changes */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {/* Staged Changes */}
        {stagedChanges.length > 0 && (
          <div>
            <SectionHeader
              title="Staged Changes"
              count={stagedChanges.length}
              collapsed={stagedCollapsed}
              onToggle={() => setStagedCollapsed((p) => !p)}
              actions={
                <SmallButton title="Unstage All" onClick={handleUnstageAll}>
                  −
                </SmallButton>
              }
            />
            {!stagedCollapsed &&
              stagedChanges.map((change) => (
                <FileChangeRow
                  key={`staged-${change.path}`}
                  change={change}
                  onUnstage={() => handleUnstage(change.path)}
                  onClick={() => handleFileDiff(change.path)}
                />
              ))}
          </div>
        )}

        {/* Changes (unstaged) */}
        <div>
          <SectionHeader
            title="Changes"
            count={unstagedChanges.length}
            collapsed={changesCollapsed}
            onToggle={() => setChangesCollapsed((p) => !p)}
            actions={
              unstagedChanges.length > 0 ? (
                <SmallButton title="Stage All" onClick={handleStageAll}>
                  +
                </SmallButton>
              ) : undefined
            }
          />
          {!changesCollapsed && unstagedChanges.length === 0 && (
            <div
              style={{
                padding: "8px 20px",
                fontSize: 11,
                color: "#808080",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              No unstaged changes
            </div>
          )}
          {!changesCollapsed &&
            unstagedChanges.map((change) => (
              <FileChangeRow
                key={`unstaged-${change.path}`}
                change={change}
                onStage={() => handleStage(change.path)}
                onDiscard={() => handleDiscard(change.path)}
                onClick={() => handleFileDiff(change.path)}
              />
            ))}
        </div>

        {/* Branch section */}
        <div>
          <SectionHeader
            title="Branch"
            count={0}
            collapsed={branchCollapsed}
            onToggle={() => setBranchCollapsed((p) => !p)}
          />
          {!branchCollapsed && (
            <div style={{ padding: "6px 12px" }}>
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  marginBottom: 6,
                }}
              >
                <button
                  onClick={handlePull}
                  style={{
                    flex: 1,
                    padding: "3px 0",
                    fontSize: 11,
                    fontFamily: "system-ui, sans-serif",
                    backgroundColor: "#2d2d2d",
                    color: "#d4d4d4",
                    border: "1px solid #555",
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#3c3c3c";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#2d2d2d";
                  }}
                >
                  &#x2193; Pull
                </button>
                <button
                  onClick={handlePush}
                  style={{
                    flex: 1,
                    padding: "3px 0",
                    fontSize: 11,
                    fontFamily: "system-ui, sans-serif",
                    backgroundColor: "#2d2d2d",
                    color: "#d4d4d4",
                    border: "1px solid #555",
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#3c3c3c";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#2d2d2d";
                  }}
                >
                  &#x2191; Push
                </button>
              </div>
              {!showNewBranch ? (
                <button
                  onClick={() => setShowNewBranch(true)}
                  style={{
                    width: "100%",
                    padding: "3px 0",
                    fontSize: 11,
                    fontFamily: "system-ui, sans-serif",
                    backgroundColor: "#2d2d2d",
                    color: "#d4d4d4",
                    border: "1px solid #555",
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#3c3c3c";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#2d2d2d";
                  }}
                >
                  + New Branch
                </button>
              ) : (
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateBranch();
                      if (e.key === "Escape") {
                        setShowNewBranch(false);
                        setNewBranchName("");
                      }
                    }}
                    placeholder="Branch name"
                    autoFocus
                    style={{
                      flex: 1,
                      padding: "2px 6px",
                      fontSize: 11,
                      fontFamily: "system-ui, sans-serif",
                      backgroundColor: "#3c3c3c",
                      color: "#d4d4d4",
                      border: "1px solid #555",
                      borderRadius: 3,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleCreateBranch}
                    style={{
                      padding: "2px 8px",
                      fontSize: 11,
                      backgroundColor: "#0e639c",
                      color: "#fff",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                    }}
                  >
                    OK
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Log section */}
        <div>
          <SectionHeader
            title="History"
            count={logEntries.length}
            collapsed={logCollapsed}
            onToggle={() => setLogCollapsed((p) => !p)}
          />
          {!logCollapsed &&
            logEntries.map((entry) => (
              <div
                key={entry.hash}
                style={{
                  padding: "2px 8px 2px 20px",
                  fontSize: 11,
                  fontFamily:
                    "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
                  color: "#d4d4d4",
                  display: "flex",
                  gap: 6,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <span style={{ color: "#e2c08d", flexShrink: 0 }}>
                  {entry.hash.substring(0, 7)}
                </span>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {entry.message}
                </span>
              </div>
            ))}
          {!logCollapsed && logEntries.length === 0 && (
            <div
              style={{
                padding: "8px 20px",
                fontSize: 11,
                color: "#808080",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              No commits yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
