"use client";

interface ShortcutGroup {
  readonly title: string;
  readonly shortcuts: readonly { keys: string; action: string }[];
}

const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: "General",
    shortcuts: [
      { keys: "Ctrl+P", action: "Quick Open (search files)" },
      { keys: "Ctrl+S", action: "Save (prevents browser dialog)" },
      { keys: "Ctrl+/", action: "Show Keyboard Shortcuts" },
    ],
  },
  {
    title: "Editor",
    shortcuts: [
      { keys: "Ctrl+W", action: "Close active tab" },
      { keys: "Ctrl+\\", action: "Split editor right" },
      { keys: "Ctrl+Z", action: "Undo" },
      { keys: "Ctrl+Shift+Z", action: "Redo" },
      { keys: "Ctrl+D", action: "Select next occurrence" },
      { keys: "Ctrl+F", action: "Find in file" },
      { keys: "Ctrl+H", action: "Find and replace" },
    ],
  },
  {
    title: "Panels",
    shortcuts: [
      { keys: "Ctrl+`", action: "Toggle Terminal" },
      { keys: "Ctrl+Shift+F", action: "Toggle Global Search" },
      { keys: "Ctrl+Shift+G", action: "Toggle Source Control" },
      { keys: "Ctrl+Shift+M", action: "Toggle Problems Panel" },
    ],
  },
];

interface KeyboardShortcutsProps {
  readonly onClose: () => void;
}

function KeyCombo({ keys }: { readonly keys: string }) {
  const parts = keys.split("+");
  return (
    <span className="flex gap-1 items-center">
      {parts.map((part, i) => (
        <span key={i}>
          <kbd
            className="px-1.5 py-0.5 bg-surface-200 border border-surface-300/60 rounded-md
            text-[11px] font-mono text-surface-800 shadow-sm"
          >
            {part}
          </kbd>
          {i < parts.length - 1 && <span className="text-surface-400 mx-0.5 text-[10px]">+</span>}
        </span>
      ))}
    </span>
  );
}

export function KeyboardShortcuts({ onClose }: KeyboardShortcutsProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] flex justify-center pt-16 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-h-[70vh] bg-surface-150 border border-surface-300/60 rounded-2xl
          shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-slide-down"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-surface-200 border-b border-surface-300/40">
          <span className="text-surface-900 text-sm font-semibold">Keyboard Shortcuts</span>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-surface-500 hover:text-surface-800 cursor-pointer
              p-1 rounded transition-colors duration-100"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2">
                {group.title}
              </h3>
              <div className="flex flex-col gap-1">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-surface-200
                      transition-colors duration-75"
                  >
                    <span className="text-[13px] text-surface-700">{shortcut.action}</span>
                    <KeyCombo keys={shortcut.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
