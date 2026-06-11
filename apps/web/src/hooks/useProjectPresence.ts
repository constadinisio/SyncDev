"use client";

import { useEffect, useState, useRef } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export interface UserPresence {
  readonly name: string;
  readonly color: string;
  readonly activeFile: string | null;
  readonly cursorLine: number | null;
}

export function useProjectPresence(
  projectId: string,
  userName: string | null,
  userColor: string,
  activeFile: string | null,
  cursorLine: number | null,
): readonly UserPresence[] {
  const [others, setOthers] = useState<readonly UserPresence[]>([]);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);

  useEffect(() => {
    if (!userName) return;

    const wsUrl =
      process.env.NEXT_PUBLIC_COLLAB_WS_URL ??
      `ws://${window.location.hostname}:4000`;

    const doc = new Y.Doc();
    const roomId = `${projectId}::__presence__`;
    const provider = new WebsocketProvider(wsUrl, roomId, doc, {
      connect: true,
    });

    docRef.current = doc;
    providerRef.current = provider;

    const awareness = provider.awareness;

    const updateOthers = () => {
      const entries: UserPresence[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (state.user && clientId !== awareness.clientID) {
          const u = state.user as UserPresence;
          entries.push(u);
        }
      });
      setOthers(entries);
    };

    awareness.on("change", updateOthers);

    return () => {
      awareness.off("change", updateOthers);
      provider.disconnect();
      provider.destroy();
      doc.destroy();
      providerRef.current = null;
      docRef.current = null;
    };
  }, [projectId, userName]);

  // Update local state when active file or cursor changes
  useEffect(() => {
    if (!providerRef.current || !userName) return;
    providerRef.current.awareness.setLocalStateField("user", {
      name: userName,
      color: userColor,
      activeFile,
      cursorLine,
    });
  }, [userName, userColor, activeFile, cursorLine]);

  return others;
}
