import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// We need to import after mocking
import { gitStatus, gitBranch, gitLog, gitInit, gitCommit, gitStage, gitDiff } from "@/lib/git-api";

type TerminalResult = { stdout: string; stderr: string; exitCode: number };

// Some git operations (gitStatus, gitCommit) sync editor content to disk first,
// which issues an extra fetch to /api/sync. The mock answers sync calls without
// consuming the terminal-response queue, so each test only enqueues the
// terminal results it cares about.
let terminalQueue: TerminalResult[] = [];

function mockTerminalResponse(result: TerminalResult) {
  terminalQueue.push(result);
}

describe("git-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalQueue = [];
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes("/api/sync/")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      const next = terminalQueue.shift() ?? { stdout: "", stderr: "", exitCode: 0 };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(next) });
    });
  });

  describe("gitStatus", () => {
    it("should parse clean status", async () => {
      mockTerminalResponse({ stdout: "", stderr: "", exitCode: 0 });
      const result = await gitStatus("test-project");
      expect(result).toEqual([]);
    });

    it("should parse untracked files", async () => {
      mockTerminalResponse({
        stdout: "?? newfile.ts\n",
        stderr: "",
        exitCode: 0,
      });
      const result = await gitStatus("test-project");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: "newfile.ts",
        status: "untracked",
        staged: false,
      });
    });

    it("should parse modified staged file", async () => {
      mockTerminalResponse({
        stdout: "M  src/index.ts\n",
        stderr: "",
        exitCode: 0,
      });
      const result = await gitStatus("test-project");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: "src/index.ts",
        status: "modified",
        staged: true,
      });
    });

    it("should parse modified unstaged file", async () => {
      mockTerminalResponse({
        stdout: " M src/index.ts\n",
        stderr: "",
        exitCode: 0,
      });
      const result = await gitStatus("test-project");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: "src/index.ts",
        status: "modified",
        staged: false,
      });
    });

    it("should return empty for non-git repos", async () => {
      mockTerminalResponse({
        stdout: "",
        stderr: "fatal: not a git repository",
        exitCode: 128,
      });
      const result = await gitStatus("test-project");
      expect(result).toEqual([]);
    });
  });

  describe("gitBranch", () => {
    it("should return current branch name", async () => {
      mockTerminalResponse({ stdout: "main\n", stderr: "", exitCode: 0 });
      const branch = await gitBranch("test-project");
      expect(branch).toBe("main");
    });

    it("should return empty string on error", async () => {
      mockTerminalResponse({ stdout: "", stderr: "error", exitCode: 1 });
      const branch = await gitBranch("test-project");
      expect(branch).toBe("");
    });
  });

  describe("gitLog", () => {
    it("should parse log entries", async () => {
      mockTerminalResponse({
        stdout: "abc1234 Initial commit\ndef5678 Add feature\n",
        stderr: "",
        exitCode: 0,
      });
      const entries = await gitLog("test-project", 10);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({ hash: "abc1234", message: "Initial commit" });
      expect(entries[1]).toEqual({ hash: "def5678", message: "Add feature" });
    });

    it("should return empty array on error", async () => {
      mockTerminalResponse({ stdout: "", stderr: "error", exitCode: 1 });
      const entries = await gitLog("test-project");
      expect(entries).toEqual([]);
    });
  });

  describe("gitCommit", () => {
    it("should escape special characters in message", async () => {
      mockTerminalResponse({
        stdout: "[main abc1234] test commit",
        stderr: "",
        exitCode: 0,
      });
      await gitCommit("test-project", 'test "quotes" and $vars and `backticks`');

      // The first call may be the sync request (no body); find the terminal call.
      const terminalCall = mockFetch.mock.calls.find((c) =>
        String(c[0]).includes("/api/terminal/"),
      );
      const body = JSON.parse(terminalCall![1].body);
      // Verify that special chars are escaped
      expect(body.command).toContain("\\$vars");
      expect(body.command).toContain("\\`backticks\\`");
      expect(body.command).toContain('\\"quotes\\"');
    });
  });

  describe("gitInit", () => {
    it("should initialize and configure user", async () => {
      // git init
      mockTerminalResponse({
        stdout: "Initialized empty Git repository",
        stderr: "",
        exitCode: 0,
      });
      // git config user.name
      mockTerminalResponse({ stdout: "", stderr: "", exitCode: 0 });
      // git config user.email
      mockTerminalResponse({ stdout: "", stderr: "", exitCode: 0 });

      const result = await gitInit("test-project");
      expect(result).toContain("Initialized");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
