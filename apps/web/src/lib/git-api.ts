import { getApiBase } from "./api";

export interface GitFileChange {
  readonly path: string;
  readonly status: "modified" | "added" | "deleted" | "untracked" | "renamed";
  readonly staged: boolean;
}

export interface GitLogEntry {
  readonly hash: string;
  readonly message: string;
}

interface TerminalResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

async function execGit(
  projectId: string,
  command: string,
): Promise<TerminalResult> {
  const res = await fetch(
    `${getApiBase()}/api/terminal/${encodeURIComponent(projectId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    },
  );
  if (!res.ok) {
    throw new Error(`Terminal API error: ${res.status}`);
  }
  return res.json();
}

function parseStatusCode(
  xy: string,
): { status: GitFileChange["status"]; staged: boolean } | null {
  const x = xy[0]; // index (staged)
  const y = xy[1]; // work tree (unstaged)

  // Untracked
  if (x === "?" && y === "?") {
    return { status: "untracked", staged: false };
  }

  // Staged changes (X column has a letter, Y is space)
  if (x === "M" && y === " ") return { status: "modified", staged: true };
  if (x === "A" && y === " ") return { status: "added", staged: true };
  if (x === "D" && y === " ") return { status: "deleted", staged: true };
  if (x === "R" && y === " ") return { status: "renamed", staged: true };

  // Unstaged changes (X is space, Y has a letter)
  if (x === " " && y === "M") return { status: "modified", staged: false };
  if (x === " " && y === "D") return { status: "deleted", staged: false };

  // Both staged and unstaged modifications — report as unstaged for simplicity
  if (x === "M" && y === "M") return { status: "modified", staged: false };

  // Added in index but modified in working tree
  if (x === "A" && y === "M") return { status: "added", staged: false };

  // Fallback: treat any X-column letter as staged, Y-column letter as unstaged
  if (x !== " " && x !== "?") {
    const statusMap: Record<string, GitFileChange["status"]> = {
      M: "modified",
      A: "added",
      D: "deleted",
      R: "renamed",
    };
    return { status: statusMap[x] ?? "modified", staged: true };
  }

  if (y !== " " && y !== "?") {
    const statusMap: Record<string, GitFileChange["status"]> = {
      M: "modified",
      D: "deleted",
    };
    return { status: statusMap[y] ?? "modified", staged: false };
  }

  return null;
}

export async function gitStatus(
  projectId: string,
): Promise<readonly GitFileChange[]> {
  const result = await execGit(projectId, "git status --porcelain");

  if (result.exitCode !== 0) {
    // If not a git repo, return empty
    if (result.stderr.includes("not a git repository")) {
      return [];
    }
    throw new Error(result.stderr || "git status failed");
  }

  const lines = result.stdout.split("\n").filter((l) => l.length >= 4);
  const changes: GitFileChange[] = [];

  for (const line of lines) {
    const xy = line.substring(0, 2);
    const filePath = line.substring(3).trim();
    if (!filePath) continue;

    const parsed = parseStatusCode(xy);
    if (!parsed) continue;

    // For files that have both staged and unstaged changes, emit two entries
    if (
      (xy[0] === "M" && xy[1] === "M") ||
      (xy[0] === "A" && xy[1] === "M")
    ) {
      changes.push({
        path: filePath,
        status: xy[0] === "A" ? "added" : "modified",
        staged: true,
      });
      changes.push({ path: filePath, status: "modified", staged: false });
    } else {
      changes.push({ path: filePath, ...parsed });
    }
  }

  return changes;
}

export async function gitDiff(
  projectId: string,
  filePath: string,
): Promise<string> {
  const result = await execGit(
    projectId,
    `git diff -- "${filePath}"`,
  );
  // Also check staged diff if working tree diff is empty
  if (!result.stdout.trim()) {
    const stagedResult = await execGit(
      projectId,
      `git diff --cached -- "${filePath}"`,
    );
    return stagedResult.stdout;
  }
  return result.stdout;
}

export async function gitStage(
  projectId: string,
  filePath: string,
): Promise<void> {
  const result = await execGit(projectId, `git add -- "${filePath}"`);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "git add failed");
  }
}

export async function gitUnstage(
  projectId: string,
  filePath: string,
): Promise<void> {
  const result = await execGit(
    projectId,
    `git reset HEAD -- "${filePath}"`,
  );
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "git reset failed");
  }
}

export async function gitCommit(
  projectId: string,
  message: string,
): Promise<string> {
  // Escape double quotes in the message
  const escaped = message.replace(/"/g, '\\"');
  const result = await execGit(projectId, `git commit -m "${escaped}"`);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "git commit failed");
  }
  return result.stdout;
}

export async function gitBranch(projectId: string): Promise<string> {
  const result = await execGit(projectId, "git branch --show-current");
  if (result.exitCode !== 0) {
    // Might not be a git repo
    return "";
  }
  return result.stdout.trim();
}

export async function gitCreateBranch(
  projectId: string,
  branchName: string,
): Promise<string> {
  const result = await execGit(
    projectId,
    `git checkout -b "${branchName}"`,
  );
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "git checkout -b failed");
  }
  return result.stdout || result.stderr;
}

export async function gitPush(projectId: string): Promise<string> {
  const result = await execGit(projectId, "git push");
  if (result.exitCode !== 0) {
    // git push outputs to stderr even on success sometimes
    if (result.stderr.includes("Everything up-to-date")) {
      return "Everything up-to-date";
    }
    throw new Error(result.stderr || "git push failed");
  }
  return result.stdout || result.stderr || "Push successful";
}

export async function gitPull(projectId: string): Promise<string> {
  const result = await execGit(projectId, "git pull");
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "git pull failed");
  }
  return result.stdout || "Already up to date.";
}

export async function gitLog(
  projectId: string,
  limit: number = 20,
): Promise<readonly GitLogEntry[]> {
  const result = await execGit(
    projectId,
    `git log --oneline -n ${limit}`,
  );
  if (result.exitCode !== 0) {
    return [];
  }

  return result.stdout
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx === -1) {
        return { hash: line.trim(), message: "" };
      }
      return {
        hash: line.substring(0, spaceIdx),
        message: line.substring(spaceIdx + 1),
      };
    });
}

export async function gitDiscard(
  projectId: string,
  filePath: string,
): Promise<void> {
  const result = await execGit(
    projectId,
    `git checkout -- "${filePath}"`,
  );
  if (result.exitCode !== 0) {
    // If untracked file, try removing it
    const rmResult = await execGit(
      projectId,
      `git clean -f -- "${filePath}"`,
    );
    if (rmResult.exitCode !== 0) {
      throw new Error(rmResult.stderr || "Failed to discard changes");
    }
  }
}

export async function gitInit(projectId: string): Promise<string> {
  const result = await execGit(projectId, "git init");
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "git init failed");
  }
  return result.stdout;
}

export async function gitStageAll(projectId: string): Promise<void> {
  const result = await execGit(projectId, "git add -A");
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "git add -A failed");
  }
}

export async function gitUnstageAll(projectId: string): Promise<void> {
  const result = await execGit(projectId, "git reset HEAD");
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "git reset failed");
  }
}
