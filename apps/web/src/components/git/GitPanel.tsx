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
  gitRemoteGet,
  gitRemoteSet,
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
  modified: "text-accent-yellow",
  added: "text-accent-green",
  deleted: "text-accent-red",
  untracked: "text-accent-green",
  renamed: "text-accent-blue",
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
  const fileName = change.path.split("/").pop() ?? change.path;
  const dirPath = change.path.includes("/")
    ? change.path.substring(0, change.path.lastIndexOf("/"))
    : "";

  return (
    <div
      onClick={onClick}
      className="group flex items-center py-0.5 pr-2 pl-5 text-xs font-sans text-surface-800
        cursor-pointer hover:bg-surface-200 transition-colors duration-75 gap-1 min-h-[22px]"
    >
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1">
        <span className={STATUS_COLORS[change.status]}>{fileName}</span>
        {dirPath && <span className="text-surface-500 text-[11px]">{dirPath}</span>}
      </span>

      <span
        className="hidden group-hover:flex gap-0.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {onDiscard && (
          <button
            onClick={onDiscard}
            title="Discard Changes"
            className="bg-transparent border-none text-surface-500 hover:text-surface-800
              cursor-pointer text-sm p-0.5 rounded transition-colors duration-100"
          >
            &#x21BA;
          </button>
        )}
        {onStage && (
          <button
            onClick={onStage}
            title="Stage Changes"
            className="bg-transparent border-none text-surface-500 hover:text-accent-green
              cursor-pointer text-sm p-0.5 rounded font-bold transition-colors duration-100"
          >
            +
          </button>
        )}
        {onUnstage && (
          <button
            onClick={onUnstage}
            title="Unstage Changes"
            className="bg-transparent border-none text-surface-500 hover:text-accent-red
              cursor-pointer text-sm p-0.5 rounded font-bold transition-colors duration-100"
          >
            &#x2212;
          </button>
        )}
      </span>

      <span
        className={`${STATUS_COLORS[change.status]} text-[11px] font-semibold w-3.5 text-center shrink-0`}
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
      className="flex items-center px-2 py-1 text-[11px] font-semibold uppercase tracking-wider
        text-surface-600 font-sans cursor-pointer select-none bg-surface-200 gap-1
        hover:bg-surface-300/50 transition-colors duration-75"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`text-surface-500 transition-transform duration-100 ${collapsed ? "-rotate-90" : ""}`}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <span>{title}</span>
      <span className="text-[10px] text-surface-500 bg-surface-300 px-1.5 rounded-full ml-1">
        {count}
      </span>
      {actions && (
        <span className="ml-auto flex gap-0.5" onClick={(e) => e.stopPropagation()}>
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
      className="bg-transparent border-none text-surface-500 hover:text-surface-800
        cursor-pointer text-[13px] p-0.5 rounded transition-colors duration-100"
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
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteInput, setRemoteInput] = useState("");
  const [showRemoteInput, setShowRemoteInput] = useState(false);
  const [gitToken, setGitToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Load saved token from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`syncdev-git-token-${projectId}`);
    if (saved) setGitToken(saved);
  }, [projectId]);

  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = useCallback((text: string, type: StatusMessage["type"]) => {
    setStatusMsg({ text, type });
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResult, branchResult, logResult, remote] = await Promise.all([
        gitStatus(projectId).catch(() => [] as readonly GitFileChange[]),
        gitBranch(projectId).catch(() => ""),
        gitLog(projectId, 10).catch(() => [] as readonly GitLogEntry[]),
        gitRemoteGet(projectId).catch(() => ""),
      ]);
      setChanges(statusResult);
      setBranch(branchResult);
      setLogEntries(logResult);
      setRemoteUrl(getCleanUrl(remote));
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
        showStatus(err instanceof Error ? err.message : "Stage failed", "error");
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
        showStatus(err instanceof Error ? err.message : "Unstage failed", "error");
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
        showStatus(err instanceof Error ? err.message : "Discard failed", "error");
      }
    },
    [projectId, refresh, showStatus],
  );

  const handleStageAll = useCallback(async () => {
    try {
      await gitStageAll(projectId);
      await refresh();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Stage all failed", "error");
    }
  }, [projectId, refresh, showStatus]);

  const handleUnstageAll = useCallback(async () => {
    try {
      await gitUnstageAll(projectId);
      await refresh();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Unstage all failed", "error");
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
      showStatus(err instanceof Error ? err.message : "Commit failed", "error");
    }
  }, [projectId, commitMessage, refresh, showStatus]);

  const handlePush = useCallback(async () => {
    try {
      const result = await gitPush(projectId);
      showStatus(result, "success");
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Push failed", "error");
    }
  }, [projectId, showStatus]);

  const handlePull = useCallback(async () => {
    try {
      const result = await gitPull(projectId);
      showStatus(result, "success");
      await refresh();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Pull failed", "error");
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
      showStatus(err instanceof Error ? err.message : "Create branch failed", "error");
    }
  }, [projectId, newBranchName, refresh, showStatus]);

  const handleInitRepo = useCallback(async () => {
    try {
      await gitInit(projectId);
      setIsGitRepo(true);
      await refresh();
      showStatus("Git repository initialized", "success");
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "git init failed", "error");
    }
  }, [projectId, refresh, showStatus]);

  // Build an authenticated URL by injecting the token
  const buildAuthUrl = useCallback((url: string, token: string): string => {
    if (!token || !url) return url;
    try {
      // Only inject token for https URLs
      if (url.startsWith("https://")) {
        const parsed = new URL(url);
        parsed.username = token;
        parsed.password = "";
        return parsed.toString();
      }
    } catch {
      // Invalid URL, return as-is
    }
    return url;
  }, []);

  // Get the display-safe URL (without token)
  const getCleanUrl = useCallback((url: string): string => {
    try {
      if (url.startsWith("https://")) {
        const parsed = new URL(url);
        if (parsed.username) {
          parsed.username = "";
          parsed.password = "";
          return parsed.toString();
        }
      }
    } catch {
      // Invalid URL
    }
    return url;
  }, []);

  const handleSetRemote = useCallback(async () => {
    if (!remoteInput.trim()) return;
    try {
      const cleanUrl = remoteInput.trim();
      // Set the remote with token if available
      const authUrl = buildAuthUrl(cleanUrl, gitToken);
      await gitRemoteSet(projectId, authUrl);
      setRemoteUrl(cleanUrl);
      setShowRemoteInput(false);
      setRemoteInput("");
      showStatus("Remote URL set successfully", "success");
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Failed to set remote", "error");
    }
  }, [projectId, remoteInput, gitToken, buildAuthUrl, showStatus]);

  const handleSaveToken = useCallback(async () => {
    const token = tokenInput.trim();
    setGitToken(token);
    localStorage.setItem(`syncdev-git-token-${projectId}`, token);
    setShowTokenInput(false);
    setTokenInput("");

    // Update remote URL with new token if remote is already set
    if (remoteUrl) {
      try {
        const authUrl = buildAuthUrl(remoteUrl, token);
        await gitRemoteSet(projectId, authUrl);
        showStatus("Token saved and remote updated", "success");
      } catch (err) {
        showStatus("Token saved but failed to update remote", "warning" as StatusMessage["type"]);
      }
    } else {
      showStatus("Token saved", "success");
    }
  }, [tokenInput, projectId, remoteUrl, buildAuthUrl, showStatus]);

  const handleFileDiff = useCallback(
    async (filePath: string) => {
      try {
        const diff = await gitDiff(projectId, filePath);
        onShowDiff?.(filePath, diff);
      } catch (err) {
        showStatus(err instanceof Error ? err.message : "Diff failed", "error");
      }
    },
    [projectId, onShowDiff, showStatus],
  );

  const canCommit = commitMessage.trim() && stagedChanges.length > 0;

  if (!isGitRepo) {
    return (
      <div className="h-full bg-surface-150 border-r border-surface-300/40 flex flex-col overflow-hidden">
        <div
          className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-surface-600
          font-sans flex justify-between items-center"
        >
          <span>Source Control</span>
          <button
            onClick={onBack}
            title="Back to Explorer"
            className="bg-transparent border-none text-surface-500 hover:text-surface-800 cursor-pointer p-1 rounded transition-colors duration-100"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
          <span className="text-surface-500 text-xs font-sans text-center">
            This project is not a git repository.
          </span>
          <button
            onClick={handleInitRepo}
            className="px-4 py-2 text-xs bg-brand-600 hover:bg-brand-500 text-white rounded-lg
              cursor-pointer font-sans font-medium transition-colors duration-150"
          >
            Initialize Repository
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-surface-150 border-r border-surface-300/40 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-surface-600
        font-sans flex justify-between items-center"
      >
        <span>Source Control</span>
        <div className="flex gap-1 items-center">
          <SmallButton title="Refresh" onClick={refresh}>
            &#x21BB;
          </SmallButton>
          <button
            onClick={onBack}
            title="Back to Explorer"
            className="bg-transparent border-none text-surface-500 hover:text-surface-800 cursor-pointer p-1 rounded transition-colors duration-100"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Branch info */}
      <div className="px-3 pb-2 text-xs font-sans text-surface-800 flex items-center gap-1.5">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-surface-500"
        >
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
        <span className="font-medium">{branch || "HEAD"}</span>
        {loading && (
          <span className="text-surface-500 text-[10px] ml-auto flex items-center gap-1">
            <span className="w-2.5 h-2.5 border border-brand-500 border-t-transparent rounded-full animate-spin" />
          </span>
        )}
      </div>

      {/* Commit input */}
      <div className="px-2 pb-2">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              handleCommit();
            }
          }}
          className="w-full p-2 text-xs font-sans bg-surface-200 text-surface-800 border border-surface-300/60
            rounded-lg outline-none resize-y min-h-[28px] max-h-[120px] leading-[18px]
            focus:border-brand-500/50 transition-colors duration-100 placeholder:text-surface-500"
          rows={1}
        />
        <button
          onClick={handleCommit}
          disabled={!canCommit}
          className={`w-full py-1.5 mt-1 text-xs font-sans font-medium rounded-lg transition-all duration-100
            ${
              canCommit
                ? "bg-brand-600 hover:bg-brand-500 text-white cursor-pointer"
                : "bg-surface-300 text-surface-500 cursor-not-allowed"
            }`}
        >
          Commit
        </button>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div
          className={`px-3 py-1.5 text-[11px] font-sans border-y border-surface-300/40 animate-fade-in
            ${
              statusMsg.type === "error"
                ? "text-accent-red bg-red-900/10"
                : statusMsg.type === "success"
                  ? "text-accent-green bg-green-900/10"
                  : "text-surface-800 bg-surface-200"
            }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* File changes */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {stagedChanges.length > 0 && (
          <div>
            <SectionHeader
              title="Staged Changes"
              count={stagedChanges.length}
              collapsed={stagedCollapsed}
              onToggle={() => setStagedCollapsed((p) => !p)}
              actions={
                <SmallButton title="Unstage All" onClick={handleUnstageAll}>
                  &#x2212;
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
            <div className="py-2 pl-5 text-[11px] text-surface-500 font-sans">
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
            <div className="p-2 flex flex-col gap-1.5">
              <div className="flex gap-1">
                <button
                  onClick={handlePull}
                  className="flex-1 py-1 text-[11px] font-sans bg-surface-200 text-surface-700
                    border border-surface-300/60 rounded-md cursor-pointer hover:bg-surface-300
                    transition-colors duration-100"
                >
                  &#x2193; Pull
                </button>
                <button
                  onClick={handlePush}
                  className="flex-1 py-1 text-[11px] font-sans bg-surface-200 text-surface-700
                    border border-surface-300/60 rounded-md cursor-pointer hover:bg-surface-300
                    transition-colors duration-100"
                >
                  &#x2191; Push
                </button>
              </div>
              {/* Remote URL */}
              <div className="flex flex-col gap-1.5 mt-2 p-2 bg-surface-150 rounded-lg border border-surface-300/30">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                  Remote Repository
                </div>

                {/* URL */}
                <div className="text-[11px] text-surface-500 flex items-center gap-1">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  {remoteUrl ? (
                    <span className="text-surface-700 truncate flex-1" title={remoteUrl}>
                      {getCleanUrl(remoteUrl)}
                    </span>
                  ) : (
                    <span className="text-surface-400 italic flex-1">No remote configured</span>
                  )}
                  <button
                    onClick={() => {
                      setShowRemoteInput(true);
                      setRemoteInput(remoteUrl);
                    }}
                    className="bg-transparent border-none text-brand-400 hover:text-brand-300
                      cursor-pointer text-[11px] transition-colors duration-100 shrink-0"
                  >
                    {remoteUrl ? "edit" : "set"}
                  </button>
                </div>
                {showRemoteInput && (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={remoteInput}
                      onChange={(e) => setRemoteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSetRemote();
                        if (e.key === "Escape") {
                          setShowRemoteInput(false);
                          setRemoteInput("");
                        }
                      }}
                      placeholder="https://github.com/user/repo.git"
                      autoFocus
                      className="flex-1 px-2 py-1 text-[11px] font-sans bg-surface-200 text-surface-800
                        border border-surface-300/60 rounded-md outline-none
                        focus:border-brand-500/50 transition-colors duration-100 placeholder:text-surface-500"
                    />
                    <button
                      onClick={handleSetRemote}
                      className="px-2 py-1 text-[11px] bg-brand-600 text-white border-none rounded-md cursor-pointer
                        hover:bg-brand-500 transition-colors duration-100"
                    >
                      Save
                    </button>
                  </div>
                )}

                {/* Token */}
                <div className="text-[11px] text-surface-500 flex items-center gap-1">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  {gitToken ? (
                    <span className="text-accent-green flex-1">Token configured</span>
                  ) : (
                    <span className="text-surface-400 italic flex-1">
                      No token (public repos only)
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setShowTokenInput(true);
                      setTokenInput("");
                    }}
                    className="bg-transparent border-none text-brand-400 hover:text-brand-300
                      cursor-pointer text-[11px] transition-colors duration-100 shrink-0"
                  >
                    {gitToken ? "change" : "add"}
                  </button>
                </div>
                {showTokenInput && (
                  <div className="flex flex-col gap-1">
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveToken();
                        if (e.key === "Escape") {
                          setShowTokenInput(false);
                          setTokenInput("");
                        }
                      }}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      autoFocus
                      className="w-full px-2 py-1 text-[11px] font-mono font-sans bg-surface-200 text-surface-800
                        border border-surface-300/60 rounded-md outline-none
                        focus:border-brand-500/50 transition-colors duration-100 placeholder:text-surface-500"
                    />
                    <div className="flex items-center justify-between">
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo&description=SyncDev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-brand-400 hover:text-brand-300 no-underline hover:underline"
                      >
                        Generate token on GitHub
                      </a>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setShowTokenInput(false);
                            setTokenInput("");
                          }}
                          className="px-2 py-0.5 text-[11px] bg-surface-200 text-surface-600
                            border border-surface-300/60 rounded-md cursor-pointer hover:bg-surface-300
                            transition-colors duration-100"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveToken}
                          className="px-2 py-0.5 text-[11px] bg-brand-600 text-white border-none rounded-md cursor-pointer
                            hover:bg-brand-500 transition-colors duration-100"
                        >
                          Save Token
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {!showNewBranch ? (
                <button
                  onClick={() => setShowNewBranch(true)}
                  className="w-full py-1 text-[11px] font-sans bg-surface-200 text-surface-700
                    border border-surface-300/60 rounded-md cursor-pointer hover:bg-surface-300
                    transition-colors duration-100"
                >
                  + New Branch
                </button>
              ) : (
                <div className="flex gap-1">
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
                    className="flex-1 px-2 py-1 text-[11px] font-sans bg-surface-200 text-surface-800
                      border border-surface-300/60 rounded-md outline-none
                      focus:border-brand-500/50 transition-colors duration-100 placeholder:text-surface-500"
                  />
                  <button
                    onClick={handleCreateBranch}
                    className="px-2 py-1 text-[11px] bg-brand-600 text-white border-none rounded-md cursor-pointer
                      hover:bg-brand-500 transition-colors duration-100"
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
                className="py-0.5 pr-2 pl-5 text-[11px] font-mono text-surface-800
                  flex gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis"
              >
                <span className="text-accent-yellow shrink-0">{entry.hash.substring(0, 7)}</span>
                <span className="overflow-hidden text-ellipsis">{entry.message}</span>
              </div>
            ))}
          {!logCollapsed && logEntries.length === 0 && (
            <div className="py-2 pl-5 text-[11px] text-surface-500 font-sans">No commits yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
