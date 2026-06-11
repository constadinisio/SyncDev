type Listener = (projectId: string) => void;

/** Aggregates per-project client counts from per-room join/leave signals. */
export class ProjectPresence {
  private readonly counts = new Map<string, number>();
  private readonly activeListeners: Listener[] = [];
  private readonly emptyListeners: Listener[] = [];

  constructor(private readonly projectOf: (roomId: string) => string) {}

  onProjectActive(fn: Listener): void {
    this.activeListeners.push(fn);
  }
  onProjectEmpty(fn: Listener): void {
    this.emptyListeners.push(fn);
  }

  count(projectId: string): number {
    return this.counts.get(projectId) ?? 0;
  }

  clientJoined(roomId: string): void {
    const id = this.projectOf(roomId);
    const next = (this.counts.get(id) ?? 0) + 1;
    this.counts.set(id, next);
    if (next === 1) this.activeListeners.forEach((fn) => fn(id));
  }

  clientLeft(roomId: string): void {
    const id = this.projectOf(roomId);
    const next = Math.max(0, (this.counts.get(id) ?? 0) - 1);
    if (next === 0) {
      this.counts.delete(id);
      this.emptyListeners.forEach((fn) => fn(id));
    } else {
      this.counts.set(id, next);
    }
  }
}

function projectOf(roomId: string): string {
  return roomId.includes("::") ? roomId.split("::")[0] : roomId;
}

/** Process-wide presence instance shared by the room manager and lifecycle. */
export const projectPresence = new ProjectPresence(projectOf);
