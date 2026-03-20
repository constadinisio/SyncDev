"use client";

import { useCallback } from "react";
import type { EditorSettings } from "@/hooks/useSettings";

interface SettingsPanelProps {
  readonly settings: EditorSettings;
  readonly onSettingsChange: (settings: EditorSettings) => void;
  readonly onClose: () => void;
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  onClose,
}: SettingsPanelProps) {
  const update = useCallback(
    (partial: Partial<EditorSettings>) => {
      onSettingsChange({ ...settings, ...partial });
    },
    [settings, onSettingsChange],
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxHeight: "80vh",
          backgroundColor: "#252526",
          border: "1px solid #404040",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            backgroundColor: "#333333",
            borderBottom: "1px solid #404040",
          }}
        >
          <span style={{ color: "#d4d4d4", fontSize: 14, fontWeight: 600 }}>
            Settings
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#808080",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#d4d4d4";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#808080";
            }}
          >
            &#x00D7;
          </button>
        </div>

        {/* Settings body */}
        <div style={{ padding: 16, overflowY: "auto" }}>
          {/* Font Size */}
          <SettingRow label="Font Size">
            <input
              type="number"
              min={12}
              max={24}
              value={settings.fontSize}
              onChange={(e) => {
                const val = Math.max(12, Math.min(24, Number(e.target.value)));
                update({ fontSize: val });
              }}
              style={inputStyle}
            />
          </SettingRow>

          {/* Tab Size */}
          <SettingRow label="Tab Size">
            <select
              value={settings.tabSize}
              onChange={(e) => update({ tabSize: Number(e.target.value) })}
              style={inputStyle}
            >
              <option value={2}>2</option>
              <option value={4}>4</option>
            </select>
          </SettingRow>

          {/* Theme */}
          <SettingRow label="Theme">
            <select
              value={settings.theme}
              onChange={(e) => update({ theme: e.target.value })}
              style={inputStyle}
            >
              <option value="vs-dark">Dark (vs-dark)</option>
              <option value="vs-light">Light (vs-light)</option>
              <option value="hc-black">High Contrast (hc-black)</option>
            </select>
          </SettingRow>

          {/* Minimap */}
          <SettingRow label="Minimap">
            <ToggleSwitch
              checked={settings.minimap}
              onChange={(checked) => update({ minimap: checked })}
            />
          </SettingRow>

          {/* Word Wrap */}
          <SettingRow label="Word Wrap">
            <ToggleSwitch
              checked={settings.wordWrap}
              onChange={(checked) => update({ wordWrap: checked })}
            />
          </SettingRow>

          {/* Line Numbers */}
          <SettingRow label="Line Numbers">
            <select
              value={settings.lineNumbers}
              onChange={(e) => update({ lineNumbers: e.target.value })}
              style={inputStyle}
            >
              <option value="on">On</option>
              <option value="off">Off</option>
              <option value="relative">Relative</option>
            </select>
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid #333333",
      }}
    >
      <span style={{ color: "#cccccc", fontSize: 13 }}>{label}</span>
      {children}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 20,
        borderRadius: 10,
        border: "none",
        backgroundColor: checked ? "#0e639c" : "#555555",
        cursor: "pointer",
        position: "relative",
        transition: "background-color 0.2s",
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: "#ffffff",
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "#3c3c3c",
  color: "#d4d4d4",
  border: "1px solid #555555",
  borderRadius: 3,
  padding: "4px 8px",
  fontSize: 13,
  fontFamily: "system-ui, sans-serif",
  outline: "none",
  minWidth: 80,
};
