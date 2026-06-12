"use client";

import { useEffect, useState } from "react";
import {
  type EnvState,
  type EnvStatus,
  getEnvStatus,
  envAction,
  scaffoldEnv,
  subscribeEnvEvents,
} from "@/lib/env-api";

interface EnvironmentPanelProps {
  readonly projectId: string;
}

const LABEL: Record<EnvStatus, string> = {
  stopped: "Stopped",
  building: "Building…",
  running: "Running",
  error: "Error",
};

const DOT: Record<EnvStatus, string> = {
  stopped: "bg-surface-500",
  building: "bg-amber-400 animate-pulse",
  running: "bg-emerald-400",
  error: "bg-red-500",
};

const MAX_LOG_LINES = 200;

export function EnvironmentPanel({ projectId }: EnvironmentPanelProps) {
  const [state, setState] = useState<EnvState>({ status: "stopped", setupFailed: false });
  const [logs, setLogs] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getEnvStatus(projectId)
      .then((s) => active && setState(s))
      .catch(() => {});
    const unsub = subscribeEnvEvents(projectId, (e) => {
      if (e.type === "status" && e.status) {
        // A fresh build replaces the previous run's output.
        if (e.status === "building") setLogs([]);
        setState({ status: e.status, setupFailed: e.setupFailed ?? false });
      } else if (e.type === "log" && e.line) {
        const line = e.line;
        setLogs((prev) => [...prev, line].slice(-MAX_LOG_LINES));
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, [projectId]);

  async function run(action: "start" | "rebuild" | "stop") {
    setBusy(true);
    try {
      setState(await envAction(projectId, action));
    } catch {
      /* surfaced via status */
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    try {
      await scaffoldEnv(projectId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col text-xs">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className={`h-2 w-2 rounded-full ${DOT[state.status]}`} />
        <span className="font-medium text-surface-300">Env: {LABEL[state.status]}</span>
        {state.setupFailed && <span className="text-amber-400">(setup failed)</span>}
        <div className="ml-auto flex gap-1">
          <button
            disabled={busy}
            onClick={create}
            className="rounded px-2 py-0.5 hover:bg-surface-700 disabled:opacity-40"
            title="Create a .devcontainer/devcontainer.json"
          >
            Create
          </button>
          <button
            disabled={busy || state.status === "running"}
            onClick={() => run("start")}
            className="rounded px-2 py-0.5 hover:bg-surface-700 disabled:opacity-40"
          >
            Start
          </button>
          <button
            disabled={busy}
            onClick={() => run("rebuild")}
            className="rounded px-2 py-0.5 hover:bg-surface-700 disabled:opacity-40"
          >
            Rebuild
          </button>
          <button
            disabled={busy || state.status === "stopped"}
            onClick={() => run("stop")}
            className="rounded px-2 py-0.5 hover:bg-surface-700 disabled:opacity-40"
          >
            Stop
          </button>
        </div>
      </div>
      {logs.length > 0 && (
        <pre className="max-h-40 overflow-auto border-t border-surface-700 bg-surface-900 px-3 py-1.5 font-mono text-[11px] leading-relaxed text-surface-400">
          {logs.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </pre>
      )}
    </div>
  );
}
