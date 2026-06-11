import { describe, it, expect } from "vitest";
import {
  parseJson,
  parseValue,
  projectIdSchema,
  relativePathSchema,
  createNodeSchema,
  cloneSchema,
  ValidationError,
} from "./validation.js";

describe("projectIdSchema", () => {
  it("accepts safe ids", () => {
    expect(parseValue(projectIdSchema, "my-app_1.2")).toBe("my-app_1.2");
  });

  it("rejects path separators and special chars", () => {
    expect(() => parseValue(projectIdSchema, "a/b")).toThrow(ValidationError);
    expect(() => parseValue(projectIdSchema, "a b")).toThrow(ValidationError);
    expect(() => parseValue(projectIdSchema, "")).toThrow(ValidationError);
  });
});

describe("relativePathSchema (path traversal)", () => {
  it("accepts nested relative paths", () => {
    expect(parseValue(relativePathSchema, "src/app/index.ts")).toBe("src/app/index.ts");
  });

  it("rejects parent traversal", () => {
    expect(() => parseValue(relativePathSchema, "../secret")).toThrow(ValidationError);
    expect(() => parseValue(relativePathSchema, "a/../../b")).toThrow(ValidationError);
  });

  it("rejects absolute paths", () => {
    expect(() => parseValue(relativePathSchema, "/etc/passwd")).toThrow(ValidationError);
    expect(() => parseValue(relativePathSchema, "C:\\Windows")).toThrow(ValidationError);
  });

  it("rejects NUL bytes", () => {
    expect(() => parseValue(relativePathSchema, "a\0b")).toThrow(ValidationError);
  });
});

describe("parseJson", () => {
  it("parses and validates a valid body", () => {
    const result = parseJson(createNodeSchema, JSON.stringify({ path: "a.ts", type: "file" }));
    expect(result).toEqual({ path: "a.ts", type: "file" });
  });

  it("throws ValidationError on malformed JSON", () => {
    expect(() => parseJson(createNodeSchema, "{not json")).toThrow(ValidationError);
  });

  it("throws ValidationError with a field path on schema mismatch", () => {
    expect(() => parseJson(createNodeSchema, JSON.stringify({ path: "a.ts", type: "x" }))).toThrow(
      /type/,
    );
  });
});

describe("cloneSchema", () => {
  it("accepts https and git urls", () => {
    expect(parseValue(cloneSchema, { repoUrl: "https://github.com/a/b.git" }).repoUrl).toContain(
      "github.com",
    );
    expect(parseValue(cloneSchema, { repoUrl: "git@github.com:a/b.git" }).repoUrl).toContain(
      "git@",
    );
  });

  it("rejects other schemes", () => {
    expect(() => parseValue(cloneSchema, { repoUrl: "file:///etc" })).toThrow(ValidationError);
    expect(() => parseValue(cloneSchema, { repoUrl: "ftp://x" })).toThrow(ValidationError);
  });
});
