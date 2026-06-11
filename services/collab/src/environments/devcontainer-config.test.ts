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

import { describe as describe2, it as it2, expect as expect2, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadProjectDevcontainer } from "./devcontainer-config.js";

describe2("loadProjectDevcontainer", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "syncdev-dc-"));
    mkdirSync(join(dir, "proj-with", ".devcontainer"), { recursive: true });
    writeFileSync(
      join(dir, "proj-with", ".devcontainer", "devcontainer.json"),
      JSON.stringify({ image: "python:3.12" }),
    );
    mkdirSync(join(dir, "proj-without"), { recursive: true });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it2("reads an existing devcontainer.json", () => {
    const cfg = loadProjectDevcontainer(join(dir, "proj-with"), DEFAULT_IMAGE);
    expect2(cfg.image).toBe("python:3.12");
  });

  it2("falls back to the default when absent", () => {
    const cfg = loadProjectDevcontainer(join(dir, "proj-without"), DEFAULT_IMAGE);
    expect2(cfg.image).toBe(DEFAULT_IMAGE);
  });
});
