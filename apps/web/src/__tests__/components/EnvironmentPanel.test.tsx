import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { EnvironmentPanel } from "@/components/environment/EnvironmentPanel";

type EnvEvent = { type: string; status?: string; setupFailed?: boolean; line?: string };

const h = vi.hoisted(() => ({
  handler: null as null | ((e: EnvEvent) => void),
}));

vi.mock("@/lib/env-api", () => ({
  getEnvStatus: vi.fn().mockResolvedValue({ status: "building", setupFailed: false }),
  envAction: vi.fn(),
  scaffoldEnv: vi.fn(),
  subscribeEnvEvents: vi.fn((_pid: string, cb: (e: EnvEvent) => void) => {
    h.handler = cb;
    return () => {};
  }),
}));

function emit(event: EnvEvent): Promise<void> {
  return act(async () => {
    h.handler?.(event);
  });
}

describe("EnvironmentPanel log streaming", () => {
  beforeEach(() => {
    h.handler = null;
  });

  it("renders streamed build log lines", async () => {
    render(<EnvironmentPanel projectId="p1" />);
    await emit({ type: "log", line: "Pulling image node:20…" });
    await emit({ type: "log", line: "added 5 packages" });

    expect(screen.getByText("Pulling image node:20…")).toBeInTheDocument();
    expect(screen.getByText("added 5 packages")).toBeInTheDocument();
  });

  it("clears prior logs when a new build starts", async () => {
    render(<EnvironmentPanel projectId="p1" />);
    await emit({ type: "log", line: "old line" });
    await emit({ type: "status", status: "building", setupFailed: false });

    expect(screen.queryByText("old line")).not.toBeInTheDocument();
  });
});
