"use client";

import { useState, useCallback, useEffect } from "react";

export interface EditorSettings {
  readonly fontSize: number;
  readonly tabSize: number;
  readonly theme: string;
  readonly minimap: boolean;
  readonly wordWrap: boolean;
  readonly lineNumbers: string;
}

const STORAGE_KEY = "collab-editor-settings";

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 2,
  theme: "vs-dark",
  minimap: true,
  wordWrap: false,
  lineNumbers: "on",
};

function loadSettings(): EditorSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<EditorSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: EditorSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Silently fail if localStorage is full
  }
}

export function useSettings(): readonly [EditorSettings, (updated: EditorSettings) => void] {
  const [settings, setSettingsState] = useState<EditorSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettingsState(loadSettings());
  }, []);

  const setSettings = useCallback((updated: EditorSettings) => {
    setSettingsState(updated);
    saveSettings(updated);
  }, []);

  return [settings, setSettings] as const;
}
