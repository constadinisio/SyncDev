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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[440px] max-h-[80vh] bg-surface-150 border border-surface-300/60 rounded-2xl
          flex flex-col overflow-hidden font-sans shadow-2xl shadow-black/40 animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-surface-200 border-b border-surface-300/40">
          <span className="text-surface-900 text-sm font-semibold">Settings</span>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-surface-500 hover:text-surface-800 cursor-pointer
              p-1 rounded transition-colors duration-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Settings body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-1">
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
              className="bg-surface-200 text-surface-800 border border-surface-300/60 rounded-lg
                px-3 py-1.5 text-[13px] font-sans outline-none min-w-[80px]
                focus:border-brand-500/50 transition-colors duration-100"
            />
          </SettingRow>

          <SettingRow label="Tab Size">
            <select
              value={settings.tabSize}
              onChange={(e) => update({ tabSize: Number(e.target.value) })}
              className="bg-surface-200 text-surface-800 border border-surface-300/60 rounded-lg
                px-3 py-1.5 text-[13px] font-sans outline-none min-w-[80px]
                focus:border-brand-500/50 transition-colors duration-100"
            >
              <option value={2}>2</option>
              <option value={4}>4</option>
            </select>
          </SettingRow>

          <SettingRow label="Theme">
            <select
              value={settings.theme}
              onChange={(e) => update({ theme: e.target.value })}
              className="bg-surface-200 text-surface-800 border border-surface-300/60 rounded-lg
                px-3 py-1.5 text-[13px] font-sans outline-none min-w-[80px]
                focus:border-brand-500/50 transition-colors duration-100"
            >
              <option value="vs-dark">Dark</option>
              <option value="vs-light">Light</option>
              <option value="hc-black">High Contrast</option>
            </select>
          </SettingRow>

          <SettingRow label="Minimap">
            <ToggleSwitch
              checked={settings.minimap}
              onChange={(checked) => update({ minimap: checked })}
            />
          </SettingRow>

          <SettingRow label="Word Wrap">
            <ToggleSwitch
              checked={settings.wordWrap}
              onChange={(checked) => update({ wordWrap: checked })}
            />
          </SettingRow>

          <SettingRow label="Line Numbers">
            <select
              value={settings.lineNumbers}
              onChange={(e) => update({ lineNumbers: e.target.value })}
              className="bg-surface-200 text-surface-800 border border-surface-300/60 rounded-lg
                px-3 py-1.5 text-[13px] font-sans outline-none min-w-[80px]
                focus:border-brand-500/50 transition-colors duration-100"
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
    <div className="flex items-center justify-between py-3 border-b border-surface-300/30">
      <span className="text-surface-700 text-[13px]">{label}</span>
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
      className={`w-10 h-5 rounded-full border-none cursor-pointer relative transition-colors duration-200
        ${checked ? "bg-brand-600" : "bg-surface-400"}`}
    >
      <div
        className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-[left] duration-200 shadow-sm"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}
