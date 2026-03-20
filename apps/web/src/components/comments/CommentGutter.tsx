"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import * as Y from "yjs";
import type { CommentData } from "./CommentThread";
import { CommentThread } from "./CommentThread";

function ymapToComment(ymap: Y.Map<unknown>): CommentData {
  return {
    id: (ymap.get("id") as string) ?? "",
    line: (ymap.get("line") as number) ?? 0,
    user: (ymap.get("user") as string) ?? "Unknown",
    color: (ymap.get("color") as string) ?? "#808080",
    text: (ymap.get("text") as string) ?? "",
    timestamp: (ymap.get("timestamp") as number) ?? 0,
    resolved: (ymap.get("resolved") as boolean) ?? false,
  };
}

interface CommentGutterProps {
  readonly doc: Y.Doc;
  readonly userName: string;
  readonly userColor: string;
  readonly glyphClickLine: number | null;
  readonly onClearGlyphClick: () => void;
}

export function CommentGutter({
  doc,
  userName,
  userColor,
  glyphClickLine,
  onClearGlyphClick,
}: CommentGutterProps) {
  const [comments, setComments] = useState<readonly CommentData[]>([]);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const prevGlyphClickLine = useRef<number | null>(null);

  // Observe the Y.Array for comments
  useEffect(() => {
    const yarray = doc.getArray<Y.Map<unknown>>("comments");

    const syncComments = () => {
      const items: CommentData[] = [];
      yarray.forEach((ymap) => {
        items.push(ymapToComment(ymap));
      });
      setComments(items);
    };

    yarray.observe(syncComments);
    syncComments();

    return () => {
      yarray.unobserve(syncComments);
    };
  }, [doc]);

  // Handle glyph margin clicks from parent
  useEffect(() => {
    if (glyphClickLine !== null && glyphClickLine !== prevGlyphClickLine.current) {
      prevGlyphClickLine.current = glyphClickLine;
      setActiveLine(glyphClickLine);
    }
  }, [glyphClickLine]);

  const handleAddComment = useCallback(
    (line: number, text: string) => {
      const yarray = doc.getArray<Y.Map<unknown>>("comments");
      const ymap = new Y.Map<unknown>();
      ymap.set(
        "id",
        `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      );
      ymap.set("line", line);
      ymap.set("user", userName);
      ymap.set("color", userColor);
      ymap.set("text", text);
      ymap.set("timestamp", Date.now());
      ymap.set("resolved", false);
      yarray.push([ymap]);
    },
    [doc, userName, userColor],
  );

  const handleResolve = useCallback(
    (commentId: string) => {
      const yarray = doc.getArray<Y.Map<unknown>>("comments");
      for (let i = 0; i < yarray.length; i++) {
        const ymap = yarray.get(i);
        if (ymap.get("id") === commentId) {
          ymap.set("resolved", true);
          break;
        }
      }
    },
    [doc],
  );

  const handleClose = useCallback(() => {
    setActiveLine(null);
    prevGlyphClickLine.current = null;
    onClearGlyphClick();
  }, [onClearGlyphClick]);

  if (activeLine === null) return null;

  const lineComments = comments.filter(
    (c) => c.line === activeLine && !c.resolved,
  );

  return (
    <div
      style={{
        position: "relative",
        zIndex: 100,
      }}
    >
      <CommentThread
        line={activeLine}
        comments={lineComments}
        userName={userName}
        userColor={userColor}
        onAddComment={handleAddComment}
        onResolve={handleResolve}
        onClose={handleClose}
      />
    </div>
  );
}

/** Returns the set of line numbers that have unresolved comments */
export function useCommentLines(doc: Y.Doc | null): ReadonlySet<number> {
  const [lines, setLines] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    if (!doc) return;

    const yarray = doc.getArray<Y.Map<unknown>>("comments");

    const sync = () => {
      const lineSet = new Set<number>();
      yarray.forEach((ymap) => {
        const resolved = ymap.get("resolved") as boolean;
        if (!resolved) {
          lineSet.add(ymap.get("line") as number);
        }
      });
      setLines(lineSet);
    };

    yarray.observe(sync);
    sync();

    return () => {
      yarray.unobserve(sync);
    };
  }, [doc]);

  return lines;
}
