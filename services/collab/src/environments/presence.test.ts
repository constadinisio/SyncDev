import { describe, it, expect, beforeEach } from "vitest";
import { ProjectPresence } from "./presence.js";

function projectOf(roomId: string): string {
  return roomId.includes("::") ? roomId.split("::")[0] : roomId;
}

describe("ProjectPresence", () => {
  let p: ProjectPresence;
  beforeEach(() => {
    p = new ProjectPresence(projectOf);
  });

  it("counts clients across a project's rooms", () => {
    p.clientJoined("proj::a.ts");
    p.clientJoined("proj::b.ts");
    expect(p.count("proj")).toBe(2);
  });

  it("fires onProjectActive on the first client and onProjectEmpty on the last", () => {
    const active: string[] = [];
    const empty: string[] = [];
    p.onProjectActive((id) => active.push(id));
    p.onProjectEmpty((id) => empty.push(id));

    p.clientJoined("proj::a.ts");
    p.clientJoined("proj::b.ts");
    expect(active).toEqual(["proj"]);

    p.clientLeft("proj::a.ts");
    expect(empty).toEqual([]);
    p.clientLeft("proj::b.ts");
    expect(empty).toEqual(["proj"]);
  });
});
