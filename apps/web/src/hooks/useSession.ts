"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface SessionState {
  readonly openTabs: string[];
  readonly activeTab: string | null;
  readonly sidebarWidth: number;
  readonly terminalOpen: boolean;
  readonly terminalHeight: number;
  readonly splitMode: boolean;
}

const DEFAULT_SESSION: SessionState = {
  openTabs: [],
  activeTab: null,
  sidebarWidth: 260,
  terminalOpen: false,
  terminalHeight: 200,
  splitMode: false,
};

function storageKey(projectId: string): string {
  return `collab-session-${projectId}`;
}

function loadSession(projectId: string): SessionState {
  if (typeof window === "undefined") return DEFAULT_SESSION;
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return DEFAULT_SESSION;
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    return { ...DEFAULT_SESSION, ...parsed };
  } catch {
    return DEFAULT_SESSION;
  }
}

function saveSession(projectId: string, session: SessionState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(session));
  } catch {
    // Silently fail if localStorage is full
  }
}

export function useSession(projectId: string): {
  readonly session: SessionState;
  readonly updateSession: (partial: Partial<SessionState>) => void;
  readonly loaded: boolean;
} {
  const [session, setSession] = useState<SessionState>(DEFAULT_SESSION);
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<SessionState>(DEFAULT_SESSION);

  // Load session on mount
  useEffect(() => {
    const restored = loadSession(projectId);
    setSession(restored);
    sessionRef.current = restored;
    setLoaded(true);
  }, [projectId]);

  // Debounced save
  const scheduleSave = useCallback(
    (updated: SessionState) => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        saveSession(projectId, updated);
        debounceRef.current = null;
      }, 500);
    },
    [projectId],
  );

  const updateSession = useCallback(
    (partial: Partial<SessionState>) => {
      const updated = { ...sessionRef.current, ...partial };
      sessionRef.current = updated;
      setSession(updated);
      scheduleSave(updated);
    },
    [scheduleSave],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        // Flush pending save
        saveSession(projectId, sessionRef.current);
      }
    };
  }, [projectId]);

  return { session, updateSession, loaded };
}
