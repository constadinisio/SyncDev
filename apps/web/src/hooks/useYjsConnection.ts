"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface YjsConnection {
  readonly doc: Y.Doc;
  readonly provider: WebsocketProvider;
  readonly ytext: Y.Text;
  readonly status: ConnectionStatus;
}

export function useYjsConnection(roomId: string): YjsConnection | null {
  const [connection, setConnection] = useState<YjsConnection | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_COLLAB_WS_URL
      ?? `ws://${window.location.hostname}:4000`;
    const doc = new Y.Doc();

    // IndexedDB persistence — survives browser restarts
    const idbPersistence = new IndexeddbPersistence(`syncdev-${roomId}`, doc);

    const provider = new WebsocketProvider(wsUrl, roomId, doc, {
      connect: true,
    });
    const ytext = doc.getText("content");

    const onStatus = ({ status: s }: { status: string }) => {
      setStatus(s === "connected" ? "connected" : s === "connecting" ? "connecting" : "disconnected");
    };

    provider.on("status", onStatus);

    setConnection({ doc, provider, ytext, status: "connecting" });

    cleanupRef.current = () => {
      provider.off("status", onStatus);
      provider.disconnect();
      provider.destroy();
      idbPersistence.destroy();
      doc.destroy();
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      setConnection(null);
    };
  }, [roomId]);

  // Keep status in sync
  useEffect(() => {
    if (connection) {
      setConnection((prev) => (prev ? { ...prev, status } : null));
    }
  }, [status]);

  return connection;
}
