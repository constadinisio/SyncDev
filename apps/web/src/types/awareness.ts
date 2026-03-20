export interface AwarenessUserState {
  readonly name: string;
  readonly color: string;
  readonly cursor: {
    readonly anchor: number;
    readonly head: number;
  } | null;
}
