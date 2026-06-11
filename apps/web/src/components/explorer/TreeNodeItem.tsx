"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { TreeNode } from "@/lib/api";
import { FileIcon } from "./FileIcon";

interface PresenceUser {
  readonly name: string;
  readonly color: string;
  readonly activeFile: string | null;
}

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
  readonly presenceUsers?: readonly PresenceUser[];
  readonly allPresence?: readonly PresenceUser[];
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
  presenceUsers,
  allPresence,
}: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isActive = node.type === "file" && path === activeFile;
  const isRenaming = renamingPath === path;

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
      e.stopPropagation();
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
        className={`flex items-center gap-1 py-[3px] pr-2 cursor-pointer text-[13px] font-sans
          select-none whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-75
          ${
            dragOver
              ? "bg-brand-600/20"
              : isActive
                ? "bg-surface-300/50 text-surface-950"
                : "text-surface-700 hover:bg-surface-200"
          }`}
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        <FileIcon name={node.name} type={node.type} expanded={expanded} />
        {isRenaming ? (
          <input
            ref={inputRef}
            defaultValue={node.name}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-surface-300 border border-brand-500 text-surface-900 text-[13px] font-sans
              py-px px-1 outline-none rounded min-w-0"
          />
        ) : (
          <span className="flex items-center gap-1 flex-1 min-w-0">
            <span className="truncate">{node.name}</span>
            {presenceUsers && presenceUsers.length > 0 && (
              <span className="flex gap-0.5 ml-auto shrink-0">
                {presenceUsers.slice(0, 3).map((u, i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: u.color }}
                    title={u.name}
                  />
                ))}
              </span>
            )}
          </span>
        )}
      </div>
      {node.type === "folder" && expanded && (
        <div>
          {node.children.map((child) => {
            const childPath = `${path}/${child.name}`;
            const childPresence = allPresence?.filter((u) => u.activeFile === childPath);
            return (
              <TreeNodeItem
                key={child.name}
                node={child}
                path={childPath}
                depth={depth + 1}
                activeFile={activeFile}
                onFileSelect={onFileSelect}
                onContextMenu={onContextMenu}
                renamingPath={renamingPath}
                onRename={onRename}
                onRenameCancel={onRenameCancel}
                onMove={onMove}
                presenceUsers={childPresence}
                allPresence={allPresence}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
