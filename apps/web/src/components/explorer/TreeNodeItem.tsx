"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { TreeNode } from "@/lib/api";
import { FileIcon } from "./FileIcon";

interface TreeNodeItemProps {
  readonly node: TreeNode;
  readonly path: string;
  readonly depth: number;
  readonly activeFile: string | null;
  readonly onFileSelect: (path: string) => void;
  readonly onContextMenu: (e: React.MouseEvent, path: string, type: "file" | "folder") => void;
  readonly renamingPath: string | null;
  readonly onRename: (path: string, newName: string) => void;
  readonly onRenameCancel: () => void;
  readonly onMove: (sourcePath: string, targetFolderPath: string) => void;
}

export function TreeNodeItem({
  node,
  path,
  depth,
  activeFile,
  onFileSelect,
  onContextMenu,
  renamingPath,
  onRename,
  onRenameCancel,
  onMove,
}: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isActive = node.type === "file" && path === activeFile;
  const isRenaming = renamingPath === path;

  // Auto-focus and select filename (without extension) when renaming
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      const dotIndex = node.name.lastIndexOf(".");
      if (dotIndex > 0 && node.type === "file") {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [isRenaming, node.name, node.type]);

  const handleClick = useCallback(() => {
    if (isRenaming) return;
    if (node.type === "folder") {
      setExpanded((prev) => !prev);
    } else {
      onFileSelect(path);
    }
  }, [node.type, path, onFileSelect, isRenaming]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu(e, path, node.type);
    },
    [path, node.type, onContextMenu],
  );

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const newName = (e.target as HTMLInputElement).value.trim();
        if (newName && newName !== node.name) {
          onRename(path, newName);
        } else {
          onRenameCancel();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onRenameCancel();
      }
    },
    [node.name, path, onRename, onRenameCancel],
  );

  const handleRenameBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const newName = e.target.value.trim();
      if (newName && newName !== node.name) {
        onRename(path, newName);
      } else {
        onRenameCancel();
      }
    },
    [node.name, path, onRename, onRenameCancel],
  );

  // Drag & drop handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", path);
      e.dataTransfer.effectAllowed = "move";
    },
    [path],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (node.type !== "folder") return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOver(true);
    },
    [node.type],
  );

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (node.type !== "folder") return;
      const sourcePath = e.dataTransfer.getData("text/plain");
      if (sourcePath && sourcePath !== path && !sourcePath.startsWith(path + "/")) {
        onMove(sourcePath, path);
      }
    },
    [node.type, path, onMove],
  );

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 8px",
          paddingLeft: depth * 16 + 8,
          cursor: "pointer",
          backgroundColor: dragOver
            ? "#094771"
            : isActive
              ? "#37373d"
              : "transparent",
          color: isActive ? "#ffffff" : "#cccccc",
          fontSize: 13,
          fontFamily: "system-ui, sans-serif",
          userSelect: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        onMouseEnter={(e) => {
          if (!isActive && !dragOver) e.currentTarget.style.backgroundColor = "#2a2d2e";
        }}
        onMouseLeave={(e) => {
          if (!isActive && !dragOver) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <FileIcon name={node.name} type={node.type} expanded={expanded} />
        {isRenaming ? (
          <input
            ref={inputRef}
            defaultValue={node.name}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              backgroundColor: "#3c3c3c",
              border: "1px solid #007acc",
              color: "#d4d4d4",
              fontSize: 13,
              fontFamily: "system-ui, sans-serif",
              padding: "1px 4px",
              outline: "none",
              borderRadius: 2,
              minWidth: 0,
            }}
          />
        ) : (
          <span>{node.name}</span>
        )}
      </div>
      {node.type === "folder" && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.name}
              node={child}
              path={`${path}/${child.name}`}
              depth={depth + 1}
              activeFile={activeFile}
              onFileSelect={onFileSelect}
              onContextMenu={onContextMenu}
              renamingPath={renamingPath}
              onRename={onRename}
              onRenameCancel={onRenameCancel}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
