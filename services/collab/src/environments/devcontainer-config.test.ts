import { describe, it, expect } from "vitest";
import { parseDevcontainer, defaultDevcontainer } from "./devcontainer-config.js";

const DEFAULT_IMAGE = "mcr.microsoft.com/devcontainers/javascript-node:20";

describe("defaultDevcontainer", () => {
  it("uses the provided default image and sensible defaults", () => {
    const cfg = defaultDevcontainer(DEFAULT_IMAGE);
    expect(cfg.image).toBe(DEFAULT_IMAGE);
    expect(cfg.postCreateCommand).toBeNull();
    expect(cfg.remoteUser).toBe("node");
    expect(cfg.workspaceFolder).toBe("/workspace");
  });
});

describe("parseDevcontainer", () => {
  it("parses a minimal valid config", () => {
    const cfg = parseDevcontainer(
      JSON.stringify({ image: "node:20", postCreateCommand: "npm install" }),
      DEFAULT_IMAGE,
    );
    expect(cfg.image).toBe("node:20");
    expect(cfg.postCreateCommand).toBe("npm install");
  });

  it("normalizes an array postCreateCommand into a single string", () => {
    const cfg = parseDevcontainer(
      JSON.stringify({ image: "node:20", postCreateCommand: ["npm", "ci"] }),
      DEFAULT_IMAGE,
    );
    expect(cfg.postCreateCommand).toBe("npm ci");
  });

  it("strips forbidden/unknown fields (privileged, runArgs, mounts)", () => {
    const cfg = parseDevcontainer(
      JSON.stringify({
        image: "node:20",
        privileged: true,
        runArgs: ["--network=host"],
        mounts: ["/etc:/etc"],
      }),
      DEFAULT_IMAGE,
    );
    expect(cfg).not.toHaveProperty("privileged");
    expect(cfg).not.toHaveProperty("runArgs");
    expect(cfg).not.toHaveProperty("mounts");
    expect(cfg.image).toBe("node:20");
  });

  it("throws on malformed JSON", () => {
    expect(() => parseDevcontainer("{not json", DEFAULT_IMAGE)).toThrow(/JSON/);
  });

  it("throws when image is missing", () => {
    expect(() => parseDevcontainer(JSON.stringify({ remoteUser: "x" }), DEFAULT_IMAGE)).toThrow(
      /image/,
    );
  });

  it("rejects a non-numeric forwardPorts entry", () => {
    expect(() =>
      parseDevcontainer(JSON.stringify({ image: "node:20", forwardPorts: ["x"] }), DEFAULT_IMAGE),
    ).toThrow();
  });
});
