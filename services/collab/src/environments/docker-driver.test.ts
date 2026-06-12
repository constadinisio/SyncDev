import { describe, it, expect } from "vitest";
import { makeLineSplitter } from "./docker-driver.js";

function collect(): { onLine: (line: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { onLine: (line) => lines.push(line), lines };
}

describe("makeLineSplitter", () => {
  it("emits complete lines split on newline", () => {
    const { onLine, lines } = collect();
    const s = makeLineSplitter(onLine);
    s.push("first\nsecond\nthird\n");
    expect(lines).toEqual(["first", "second", "third"]);
  });

  it("buffers a partial line until the rest of it arrives", () => {
    const { onLine, lines } = collect();
    const s = makeLineSplitter(onLine);
    s.push("Pulling fs ");
    expect(lines).toEqual([]);
    s.push("layer\n");
    expect(lines).toEqual(["Pulling fs layer"]);
  });

  it("strips a trailing carriage return (CRLF)", () => {
    const { onLine, lines } = collect();
    const s = makeLineSplitter(onLine);
    s.push("windows line\r\nunix line\n");
    expect(lines).toEqual(["windows line", "unix line"]);
  });

  it("skips blank lines", () => {
    const { onLine, lines } = collect();
    const s = makeLineSplitter(onLine);
    s.push("a\n\n\nb\n");
    expect(lines).toEqual(["a", "b"]);
  });

  it("flush emits a trailing line with no newline", () => {
    const { onLine, lines } = collect();
    const s = makeLineSplitter(onLine);
    s.push("no newline at end");
    expect(lines).toEqual([]);
    s.flush();
    expect(lines).toEqual(["no newline at end"]);
  });

  it("flush on an empty buffer emits nothing", () => {
    const { onLine, lines } = collect();
    const s = makeLineSplitter(onLine);
    s.push("done\n");
    s.flush();
    expect(lines).toEqual(["done"]);
  });
});
