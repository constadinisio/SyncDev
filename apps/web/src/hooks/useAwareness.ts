"use client";

import { useEffect, useState } from "react";
import type { WebsocketProvider } from "y-websocket";
import type { AwarenessUserState } from "@/types/awareness";

const COLORS = [
  "#e06c75",
  "#61afef",
  "#98c379",
  "#e5c07b",
  "#c678dd",
  "#56b6c2",
  "#d19a66",
  "#be5046",
];

function pickColor(clientId: number): string {
  return COLORS[clientId % COLORS.length];
}

function generateName(): string {
  const adjectives = ["Swift", "Bright", "Calm", "Bold", "Keen"];
  const nouns = ["Fox", "Owl", "Bear", "Wolf", "Hawk"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}

export interface AwarenessEntry {
  readonly clientId: number;
  readonly user: AwarenessUserState;
}

export function useAwareness(
  provider: WebsocketProvider | null,
  userName?: string,
): readonly AwarenessEntry[] {
  const [users, setUsers] = useState<readonly AwarenessEntry[]>([]);

  useEffect(() => {
    if (!provider) return;

    const awareness = provider.awareness;
    const displayName = userName ?? generateName();
    const color = pickColor(awareness.clientID);

    // Set local user state
    awareness.setLocalStateField("user", {
      name: displayName,
      color,
      cursor: null,
    });

    const updateUsers = () => {
      const entries: AwarenessEntry[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (state.user && clientId !== awareness.clientID) {
          entries.push({ clientId, user: state.user as AwarenessUserState });
        }
      });
      setUsers(entries);
    };

    awareness.on("change", updateUsers);
    updateUsers();

    return () => {
      awareness.off("change", updateUsers);
    };
  }, [provider, userName]);

  return users;
}
