import type { WebSocket } from "ws";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";

export interface UpdateLogEntry {
  readonly user: string;
  readonly timestamp: number;
}

export interface Room {
  readonly id: string;
  readonly doc: Y.Doc;
  readonly clients: Set<WebSocket>;
  readonly awareness: Awareness;
  readonly updateLog: UpdateLogEntry[];
  persistTimer: ReturnType<typeof setTimeout> | null;
  destroyTimer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
}
