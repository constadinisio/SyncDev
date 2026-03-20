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

interface FileExplorerProps {
  readonly projectId: string;
  readonly tree: TreeNode[];
  readonly activeFile: string | null;
  readonly onFileSelect: (path: string) => void;
  readonly onTreeUpdate: (tree: ProjectTree) => void;
  readonly onDeleteFile?: (path: string) => void;
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
}: FileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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

  const handleDelete = useCallback(
    async (path: string) => {
      if (!confirm(`Delete "${path}"?`)) return;
      const updated = await deleteProjectNode(projectId, path);
      onTreeUpdate(updated);
      onDeleteFile?.(path);
    },
    [projectId, onTreeUpdate, onDeleteFile],
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
    // Check if dragging external files
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    } else {
      e.dataTransfer.dropEffect = "move";
    }
  }, []);

  const handleRootDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the container itself
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

      // Check for external file drops first
      if (e.dataTransfer.files.length > 0) {
        void handleUploadFiles(e.dataTransfer.files, "");
        return;
      }

      // Internal tree node move
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
    <div
      style={{
        height: "100%",
        backgroundColor: "#252526",
        borderRight: "1px solid #404040",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#bbbbbb",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Explorer</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => promptAndCreate("", "file")}
            title="New File"
            style={{
              background: "none",
              border: "none",
              color: "#cccccc",
              cursor: "pointer",
              fontSize: 16,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            +
          </button>
          <button
            onClick={() => promptAndCreate("", "folder")}
            title="New Folder"
            style={{
              background: "none",
              border: "none",
              color: "#cccccc",
              cursor: "pointer",
              fontSize: 14,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            📁
          </button>
        </div>
      </div>

      {/* Project name */}
      <div
        style={{
          padding: "4px 12px",
          fontSize: 13,
          fontWeight: 600,
          color: "#cccccc",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        ▾ {projectId.toUpperCase()}
      </div>

      {/* Tree */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          border: isDragOver ? "2px dashed #0e639c" : "2px solid transparent",
          transition: "border-color 0.15s",
        }}
        onContextMenu={handleRootContextMenu}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
        {tree.length === 0 ? (
          <div
            style={{
              padding: "16px 12px",
              color: "#808080",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Right-click to create files
          </div>
        ) : (
          tree.map((node) => (
            <TreeNodeItem
              key={node.name}
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
            />
          ))
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
