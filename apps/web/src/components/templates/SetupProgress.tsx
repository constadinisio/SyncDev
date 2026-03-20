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
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#1e1e1e",
          border: "1px solid #404040",
          borderRadius: 8,
          padding: "32px 40px",
          minWidth: 400,
          maxWidth: 500,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Template icon and name */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 48 }}>{template.icon}</span>
          <h2 style={{ color: "#d4d4d4", fontSize: 18, fontWeight: 600, margin: 0 }}>
            Setting up {template.name}
          </h2>
          {!done && !error && (
            <span style={{ color: "#808080", fontSize: 13 }}>
              This may take a minute{dots}
            </span>
          )}
        </div>

        {/* Steps */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 12px",
                backgroundColor: "#252526",
                borderRadius: 4,
                border: `1px solid ${
                  step.status === "error"
                    ? "#f48771"
                    : step.status === "running"
                      ? "#0e639c"
                      : "#333333"
                }`,
              }}
            >
              {/* Status icon */}
              <span
                style={{
                  fontSize: 16,
                  width: 20,
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                {step.status === "pending" && (
                  <span style={{ color: "#555" }}>○</span>
                )}
                {step.status === "running" && (
                  <span
                    style={{
                      color: "#0e639c",
                      display: "inline-block",
                      animation: "spin 1s linear infinite",
                    }}
                  >
                    ◌
                  </span>
                )}
                {step.status === "done" && (
                  <span style={{ color: "#73c991" }}>✓</span>
                )}
                {step.status === "error" && (
                  <span style={{ color: "#f48771" }}>✗</span>
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    color:
                      step.status === "done"
                        ? "#73c991"
                        : step.status === "error"
                          ? "#f48771"
                          : step.status === "running"
                            ? "#d4d4d4"
                            : "#808080",
                    fontSize: 13,
                  }}
                >
                  {step.label}
                </span>
                {step.error && (
                  <div
                    style={{
                      color: "#f48771",
                      fontSize: 11,
                      marginTop: 4,
                      whiteSpace: "pre-wrap",
                      maxHeight: 60,
                      overflow: "auto",
                    }}
                  >
                    {step.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              color: "#f48771",
              fontSize: 13,
              textAlign: "center",
              padding: "8px 12px",
              backgroundColor: "#3a1d1d",
              borderRadius: 4,
              width: "100%",
            }}
          >
            {error}
          </div>
        )}

        {/* Post-creation message */}
        {done && template.postMessage && (
          <div
            style={{
              color: "#73c991",
              fontSize: 13,
              textAlign: "center",
              padding: "8px 12px",
              backgroundColor: "#1d3a28",
              borderRadius: 4,
              width: "100%",
            }}
          >
            {template.postMessage}
          </div>
        )}

        {/* Open Project button */}
        {(done || error) && (
          <button
            onClick={onOpen}
            style={{
              padding: "8px 24px",
              fontSize: 14,
              backgroundColor: "#0e639c",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {done ? "Open Project" : "Continue Anyway"}
          </button>
        )}
      </div>

      {/* Inline keyframes for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
