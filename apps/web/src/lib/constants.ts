export function getCollabWsUrl(): string {
  if (process.env.NEXT_PUBLIC_COLLAB_WS_URL) {
    return process.env.NEXT_PUBLIC_COLLAB_WS_URL;
  }
  if (typeof window !== "undefined") {
    return `ws://${window.location.hostname}:4000`;
  }
  return "ws://localhost:4000";
}
