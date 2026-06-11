/**
 * Tracks whether the server has finished initializing its dependencies
 * (room manager, snapshot dir, etc.) and is ready to accept real traffic.
 *
 * Liveness (/health) only checks the process is up; readiness (/ready) gates
 * traffic until startup completes and flips back to false during shutdown.
 */
let ready = false;

export function markReady(): void {
  ready = true;
}

export function markNotReady(): void {
  ready = false;
}

export function isServerReady(): boolean {
  return ready;
}
