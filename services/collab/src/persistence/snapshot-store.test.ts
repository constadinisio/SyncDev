import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let mod: typeof import("./snapshot-store.js");
let tmpDir: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "syncdev-snapshots-"));
  process.env.NODE_ENV = "test";
  process.env.SNAPSHOT_DIR = tmpDir;

  mod = await import("./snapshot-store.js");
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("saveSnapshot / loadSnapshot", () => {
  it("saves and loads a snapshot round-trip", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    mod.saveSnapshot("room-roundtrip", data);
    const loaded = mod.loadSnapshot("room-roundtrip");
    expect(loaded).not.toBeNull();
    expect(Array.from(loaded!)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns null for a room with no snapshot", () => {
    const result = mod.loadSnapshot("nonexistent-room-xyz");
    expect(result).toBeNull();
  });

  it("loaded data matches the saved Uint8Array content", () => {
    const original = new Uint8Array([10, 20, 30]);
    mod.saveSnapshot("room-content", original);
    const loaded = mod.loadSnapshot("room-content");
    expect(Array.from(loaded!)).toEqual([10, 20, 30]);
  });

  it("overwrites a previous snapshot with new data", () => {
    mod.saveSnapshot("room-overwrite", new Uint8Array([1]));
    mod.saveSnapshot("room-overwrite", new Uint8Array([9, 8, 7]));
    const loaded = mod.loadSnapshot("room-overwrite");
    expect(Array.from(loaded!)).toEqual([9, 8, 7]);
  });

  it("sanitises room IDs that contain special characters (:: and /)", () => {
    const data = new Uint8Array([42]);
    mod.saveSnapshot("project::path/to/file.ts", data);
    const loaded = mod.loadSnapshot("project::path/to/file.ts");
    expect(Array.from(loaded!)).toEqual([42]);
  });

  it("handles an empty Uint8Array", () => {
    const empty = new Uint8Array(0);
    mod.saveSnapshot("room-empty", empty);
    const loaded = mod.loadSnapshot("room-empty");
    expect(loaded).not.toBeNull();
    expect(loaded!.byteLength).toBe(0);
  });
});

describe("deleteSnapshot", () => {
  it("deletes an existing snapshot so loadSnapshot returns null", () => {
    mod.saveSnapshot("room-delete", new Uint8Array([1, 2]));
    expect(mod.loadSnapshot("room-delete")).not.toBeNull();
    mod.deleteSnapshot("room-delete");
    expect(mod.loadSnapshot("room-delete")).toBeNull();
  });

  it("is a no-op for a snapshot that does not exist", () => {
    expect(() => mod.deleteSnapshot("room-never-existed")).not.toThrow();
  });
});
