"use client";

import { useEffect, useState } from "react";
import type { ProjectTemplate } from "@/lib/templates";

interface SetupStep {
  readonly label: string;
  readonly status: "pending" | "running" | "done" | "error";
  readonly error?: string;
}

interface SetupProgressProps {
  readonly template: ProjectTemplate;
  readonly steps: readonly SetupStep[];
  readonly done: boolean;
  readonly error: string | null;
  readonly onOpen: () => void;
}

export function SetupProgress({
  template,
  steps,
  done,
  error,
  onOpen,
}: SetupProgressProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (done || error) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [done, error]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center font-sans animate-fade-in">
      <div className="bg-surface-100 border border-surface-300/60 rounded-2xl p-10 min-w-[420px] max-w-[520px]
        flex flex-col items-center gap-6 shadow-2xl shadow-black/40 animate-scale-in">
        {/* Template icon and name */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl">{template.icon}</span>
          <h2 className="text-surface-900 text-lg font-semibold m-0">
            Setting up {template.name}
          </h2>
          {!done && !error && (
            <span className="text-surface-500 text-[13px]">
              This may take a minute{dots}
            </span>
          )}
        </div>

        {/* Steps */}
        <div className="w-full flex flex-col gap-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 bg-surface-150 rounded-lg border transition-colors duration-200
                ${step.status === "error"
                  ? "border-accent-red/50"
                  : step.status === "running"
                    ? "border-brand-500/50"
                    : "border-surface-300/40"
                }`}
            >
              <span className="text-base w-5 text-center shrink-0">
                {step.status === "pending" && (
                  <span className="text-surface-400">&#x25CB;</span>
                )}
                {step.status === "running" && (
                  <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin inline-block" />
                )}
                {step.status === "done" && (
                  <span className="text-accent-green">&#x2713;</span>
                )}
                {step.status === "error" && (
                  <span className="text-accent-red">&#x2717;</span>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-[13px] ${
                    step.status === "done"
                      ? "text-accent-green"
                      : step.status === "error"
                        ? "text-accent-red"
                        : step.status === "running"
                          ? "text-surface-800"
                          : "text-surface-500"
                  }`}
                >
                  {step.label}
                </span>
                {step.error && (
                  <div className="text-accent-red text-[11px] mt-1 whitespace-pre-wrap max-h-[60px] overflow-auto">
                    {step.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="text-accent-red text-[13px] text-center p-3 bg-red-900/10 rounded-lg w-full border border-accent-red/20">
            {error}
          </div>
        )}

        {done && template.postMessage && (
          <div className="text-accent-green text-[13px] text-center p-3 bg-green-900/10 rounded-lg w-full border border-accent-green/20">
            {template.postMessage}
          </div>
        )}

        {(done || error) && (
          <button
            onClick={onOpen}
            className="px-6 py-2.5 text-sm bg-brand-600 hover:bg-brand-500 text-white font-semibold
              rounded-lg cursor-pointer transition-colors duration-150 shadow-lg shadow-brand-600/25"
          >
            {done ? "Open Project" : "Continue Anyway"}
          </button>
        )}
      </div>
    </div>
  );
}
