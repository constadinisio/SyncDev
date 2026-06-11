import type { ProjectPresence } from "./presence.js";

export interface IdleStopDeps {
  readonly idleMs: number;
  readonly stop: (projectId: string) => void;
}

/** Stops a project's environment after it has had no clients for `idleMs`. */
export function wireIdleStop(presence: ProjectPresence, deps: IdleStopDeps): void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  presence.onProjectActive((projectId) => {
    const t = timers.get(projectId);
    if (t) {
      clearTimeout(t);
      timers.delete(projectId);
    }
  });

  presence.onProjectEmpty((projectId) => {
    const t = setTimeout(() => {
      timers.delete(projectId);
      deps.stop(projectId);
    }, deps.idleMs);
    timers.set(projectId, t);
  });
}
