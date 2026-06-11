import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProjectPresence } from "./presence.js";
import { wireIdleStop } from "./lifecycle.js";

describe("wireIdleStop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stops a project after the idle delay once empty", () => {
    const presence = new ProjectPresence((r) => r);
    const stop = vi.fn();
    wireIdleStop(presence, { idleMs: 1000, stop });

    presence.clientJoined("proj");
    presence.clientLeft("proj");
    expect(stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(stop).toHaveBeenCalledWith("proj");
  });

  it("cancels the stop if a client reconnects within the delay", () => {
    const presence = new ProjectPresence((r) => r);
    const stop = vi.fn();
    wireIdleStop(presence, { idleMs: 1000, stop });

    presence.clientJoined("proj");
    presence.clientLeft("proj");
    vi.advanceTimersByTime(500);
    presence.clientJoined("proj");
    vi.advanceTimersByTime(1000);
    expect(stop).not.toHaveBeenCalled();
  });
});
