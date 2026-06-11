"use client";

import { useState, useCallback } from "react";
import type { TreeNode, ProjectTree } from "@/lib/api";
import {
  createProjectNode,
  deleteProjectNode,
  renameProjectNode,
  moveProjectNode,
  getApiBase,
} from "@/lib/api";
import { TreeNodeItem } from "./TreeNodeItem";
import { ContextMenu } from "./ContextMenu";

interface UserPresenceInfo {
  readonly name: string;
  readonly color: string;
  readonly activeFile: string | null;
}

interface FileExplorerProps {
  readonly projectId: string;
  readonly tree: TreeNode[];
  readonly activeFile: string | null;
  readonly onFileSelect: (path: string) => void;
  readonly onTreeUpdate: (tree: ProjectTree) => void;
  readonly onDeleteFile?: (path: string) => void;
  readonly userPresence?: readonly UserPresenceInfo[];
}

interface ContextMenuState {
  readonly x: number;
  readonly y: number;
  readonly path: string;
  readonly type: "file" | "folder" | "root";
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}

export function FileExplorer({
  projectId,
  tree,
  activeFile,
  onFileSelect,
  onTreeUpdate,
  onDeleteFile,
  userPresence,
}: FileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [collapseKey, setCollapseKey] = useState(0);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, path: string, type: "file" | "folder") => {
      setContextMenu({ x: e.clientX, y: e.clientY, path, type });
    },
    [],
  );

  const handleRootContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path: "", type: "root" });
  }, []);

  const promptAndCreate = useCallback(
    async (parentPath: string, type: "file" | "folder") => {
      const name = prompt(`New ${type} name:`);
      if (!name) return;
      const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fullPath = parentPath ? `${parentPath}/${sanitized}` : sanitized;
      const updated = await createProjectNode(projectId, fullPath, type);
      onTreeUpdate(updated);
    },
    [projectId, onTreeUpdate],
  );

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const handleDelete = useCallback(
    (path: string) => {
      setPendingDelete(path);
    },
    [],
  );

  const confirmDelete = useCallback(
    async () => {
      if (!pendingDelete) return;
      try {
        const updated = await deleteProjectNode(projectId, pendingDelete);
        onTreeUpdate(updated);
        onDeleteFile?.(pendingDelete);
      } catch (err) {
        console.error("Delete failed:", err);
      } finally {
        setPendingDelete(null);
      }
    },
    [pendingDelete, projectId, onTreeUpdate, onDeleteFile],
  );

  const handleRename = useCallback(
    async (path: string, newName: string) => {
      try {
        const sanitized = newName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const updated = await renameProjectNode(projectId, path, sanitized);
        onTreeUpdate(updated);
      } catch (err) {
        console.error("Failed to rename:", err);
      } finally {
        setRenamingPath(null);
      }
    },
    [projectId, onTreeUpdate],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingPath(null);
  }, []);

  const handleMove = useCallback(
    async (sourcePath: string, targetFolderPath: string) => {
      try {
        const updated = await moveProjectNode(projectId, sourcePath, targetFolderPath);
        onTreeUpdate(updated);
      } catch (err) {
        console.error("Failed to move:", err);
      }
    },
    [projectId, onTreeUpdate],
  );

  const handleUploadFiles = useCallback(
    async (files: FileList, targetFolder: string) => {
      const uploadFiles: { path: string; content: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const content = await readFileAsText(file);
          const filePath = targetFolder
            ? `${targetFolder}/${file.name}`
            : file.name;
          uploadFiles.push({ path: filePath, content });
        } catch (err) {
          console.error(`Failed to read file ${file.name}:`, err);
        }
      }

      if (uploadFiles.length === 0) return;

      try {
        const res = await fetch(
          `${getApiBase()}/api/upload/${encodeURIComponent(projectId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: uploadFiles }),
          },
        );
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const updated: ProjectTree = await res.json();
        onTreeUpdate(updated);
      } catch (err) {
        console.error("Failed to upload files:", err);
      }
    },
    [projectId, onTreeUpdate],
  );

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    } else {
      e.dataTransfer.dropEffect = "move";
    }
  }, []);

  const handleRootDragLeave = useCallback((e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      setIsDragOver(false);
    }
  }, []);

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      if (e.dataTransfer.files.length > 0) {
        void handleUploadFiles(e.dataTransfer.files, "");
        return;
      }

      const sourcePath = e.dataTransfer.getData("text/plain");
      if (sourcePath) {
        handleMove(sourcePath, "");
      }
    },
    [handleMove, handleUploadFiles],
  );

  const getContextMenuItems = useCallback(() => {
    if (!contextMenu) return [];
    const { path, type } = contextMenu;

    if (type === "root") {
      return [
        { label: "New File", action: () => promptAndCreate("", "file") },
        { label: "New Folder", action: () => promptAndCreate("", "folder") },
      ];
    }

    if (type === "folder") {
      return [
        { label: "New File", action: () => promptAndCreate(path, "file") },
        { label: "New Folder", action: () => promptAndCreate(path, "folder") },
        { label: "Rename", action: () => setRenamingPath(path) },
        { label: "Delete", action: () => handleDelete(path) },
      ];
    }

    return [
      { label: "Rename", action: () => setRenamingPath(path) },
      { label: "Delete", action: () => handleDelete(path) },
    ];
  }, [contextMenu, promptAndCreate, handleDelete]);

  return (
    <div className="h-full bg-surface-150 border-r border-surface-300/40 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-surface-600
        font-sans flex justify-between items-center">
        <span>Explorer</span>
        <div className="flex gap-1">
          <button
            onClick={() => {
              // Collapse all folders by triggering a re-render with a key change
              setCollapseKey((k) => k + 1);
            }}
            title="Collapse All"
            className="bg-transparent border-none text-surface-600 hover:text-surface-800 cursor-pointer p-1 rounded
              transition-colors duration-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
          <button
            onClick={() => promptAndCreate("", "file")}
            title="New File"
            className="bg-transparent border-none text-surface-600 hover:text-surface-800 cursor-pointer p-1 rounded
              transition-colors duration-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </button>
          <button
            onClick={() => promptAndCreate("", "folder")}
            title="New Folder"
            className="bg-transparent border-none text-surface-600 hover:text-surface-800 cursor-pointer p-1 rounded
              transition-colors duration-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Project name */}
      <div className="px-3 py-1 text-[13px] font-semibold text-surface-700 font-sans flex items-center gap-1.5">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-surface-500">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        {projectId.toUpperCase()}
      </div>

      {/* Tree */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden transition-all duration-150
          ${isDragOver ? "border-2 border-dashed border-brand-500" : "border-2 border-transparent"}`}
        onContextMenu={handleRootContextMenu}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
        {tree.length === 0 ? (
          <div className="px-3 py-4 text-surface-500 text-xs font-sans">
            Right-click to create files
          </div>
        ) : (
          tree.map((node) => {
            const usersOnFile = userPresence?.filter(
              (u) => u.activeFile === node.name,
            );
            return (
              <TreeNodeItem
                key={`${node.name}-${collapseKey}`}
                node={node}
                path={node.name}
                depth={1}
                activeFile={activeFile}
                onFileSelect={onFileSelect}
                onContextMenu={handleContextMenu}
                renamingPath={renamingPath}
                onRename={handleRename}
                onRenameCancel={handleRenameCancel}
                onMove={handleMove}
                presenceUsers={usersOnFile}
                allPresence={userPresence}
              />
            );
          })
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center animate-fade-in">
          <div className="bg-surface-150 border border-surface-300/60 rounded-xl p-5 min-w-[320px]
            flex flex-col gap-4 shadow-2xl shadow-black/40 animate-scale-in font-sans">
            <div className="text-surface-900 text-sm font-semibold">Delete file?</div>
            <div className="text-surface-600 text-xs">
              Are you sure you want to delete <span className="font-medium text-surface-800">{pendingDelete}</span>? This cannot be undone.
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 text-xs font-medium bg-surface-200 text-surface-700
                  border border-surface-300/60 rounded-lg cursor-pointer hover:bg-surface-300
                  transition-colors duration-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-500 text-white
                  border-none rounded-lg cursor-pointer transition-colors duration-100"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
