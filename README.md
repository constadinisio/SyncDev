# SyncDev

A self-hosted, real-time collaborative code editor. Multiple developers can edit the same files simultaneously with automatic conflict resolution — like Google Docs for code.

Built with **Yjs CRDTs** for collaboration, **Monaco Editor** for the editing experience, and **WebSockets** for real-time transport. No Firebase, no external databases — everything runs on your machine.

## Features

### Collaborative Editing
- Real-time synchronization via Yjs CRDTs — no merge conflicts, no overwrites
- Named cursors showing each user's position and selection
- User presence indicators with unique colors
- Automatic reconnection without losing changes
- Persistent snapshots that survive server restarts

### IDE Experience
- **Monaco Editor** — the same editor that powers VS Code
- **File Explorer** — tree view with create, rename, delete, drag & drop
- **Tabs** — multiple open files with tab management
- **Split Editor** — side-by-side editing of different files
- **Breadcrumbs** — file path navigation
- **Status Bar** — cursor position, language, encoding, connection status
- **Minimap** — code overview
- **Quick Open** — Ctrl+P to search and open files
- **Global Search** — Ctrl+Shift+F to search across all project files
- **Settings** — customizable font size, tab size, theme, word wrap, line numbers

### Built-in Terminal
- Execute any shell command from the browser
- Full access to npm, node, git, python, and all system tools
- Long-running command support (5 min timeout for `npm install`, builds, etc.)
- Command history navigation
- Isolated workspace per project

### Collaboration Tools
- **Chat** — real-time messaging between collaborators (powered by Yjs)
- **Code Comments** — annotate specific lines with threaded discussions
- **Edit History** — timeline of who changed what and when

### Live Preview
- Serves project files directly from in-memory Yjs documents
- Auto-reload on edit (500ms debounce via Server-Sent Events)
- Single shareable URL per project
- Supports HTML, CSS, JS with proper MIME types

### Source Control
- Git integration panel — status, stage, unstage, commit, push, pull
- Branch management — view current branch, create new branches
- Diff viewer for modified files
- Discard changes per file

### Project Templates
Start new projects instantly from templates:
- **HTML/CSS/JS** — basic web page
- **Next.js** — full Next.js setup with TypeScript and Tailwind
- **React (Vite)** — React + TypeScript via Vite
- **Node.js API** — Express server
- **Python** — FastAPI starter
- **Static Site** — multi-page HTML site

### File Management
- **Download as ZIP** — export entire project
- **Upload files** — drag & drop files from your desktop
- **Markdown Preview** — rendered `.md` files with dark theme
- **Session Persistence** — remembers open tabs, layout, and preferences

### Code Intelligence (Monaco built-in)
- TypeScript/JavaScript autocompletion and diagnostics
- Bracket pair colorization
- Semantic highlighting
- Code folding
- Format on paste/type
- Problems panel (Ctrl+Shift+M)

## Architecture

```
apps/web/              Next.js 14 frontend + Monaco Editor + Yjs client
services/collab/       WebSocket server + Yjs rooms + HTTP API + persistence
storage/
  snapshots/           Yjs document snapshots (.ystate binary files)
  workspaces/          Terminal working directories per project
  projects/            File tree manifests (JSON)
infra/                 Docker Compose configuration
```

### How Synchronization Works

1. User types in Monaco → `y-monaco` translates to `Y.Text.insert()`
2. Yjs generates an incremental CRDT delta (binary, not full text)
3. `y-websocket` sends the delta to the collab server via WebSocket
4. Server applies the update to its authoritative `Y.Doc`
5. Server broadcasts the delta to all other connected clients
6. Other clients apply the delta → Monaco updates automatically

No full-text overwrites. No manual merge. CRDT convergence is automatic by mathematical guarantee.

## Quick Start

### Prerequisites
- Node.js 20+
- npm

### Development

```bash
# Install dependencies
npm install

# Terminal 1: Start collaboration server
npm run dev:collab

# Terminal 2: Start frontend
npm run dev:web
```

Open http://localhost:3000

### Production (local network / Tailscale)

```bash
# Build frontend
npx -w apps/web next build

# Terminal 1: Start collab server
npm run dev:collab

# Terminal 2: Start frontend (listen on all interfaces)
npx -w apps/web next start --port 3000 --hostname 0.0.0.0
```

Share your IP (or Tailscale IP) with collaborators: `http://<your-ip>:3000`

### Docker Compose

```bash
cd infra
docker compose up --build
```

- Frontend: http://localhost:3000
- Collab server: ws://localhost:4000

## Environment Variables

### Frontend (build-time)
| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_COLLAB_WS_URL` | auto-detect | WebSocket URL (auto-resolves from browser hostname) |
| `NEXT_PUBLIC_API_URL` | auto-detect | API URL (auto-resolves from browser hostname) |

### Collab Server
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `HOST` | `0.0.0.0` | Listen address |
| `SNAPSHOT_DIR` | `./storage/snapshots` | Snapshot directory |
| `SNAPSHOT_DEBOUNCE_MS` | `2000` | Debounce for snapshot saves |
| `SNAPSHOT_INTERVAL_MS` | `30000` | Periodic save interval |
| `ROOM_GRACE_PERIOD_MS` | `30000` | Time before destroying empty rooms |
| `PROJECTS_DIR` | `./storage/projects` | File tree manifests directory |
| `TERMINAL_WORKSPACE_DIR` | `./storage/workspaces` | Terminal working directories |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Quick Open (search files) |
| `Ctrl+Shift+F` | Global Search |
| `Ctrl+Shift+G` | Source Control |
| `Ctrl+Shift+M` | Problems Panel |
| `Ctrl+\`` | Toggle Terminal |
| `Ctrl+W` | Close active tab |
| `Ctrl+S` | Save (prevents browser dialog) |

## Tech Stack

- **Frontend:** Next.js 14, React 18, Monaco Editor, TypeScript
- **Collaboration:** Yjs, y-monaco, y-websocket, y-protocols
- **Backend:** Node.js, ws (WebSocket), lib0
- **Persistence:** Atomic file snapshots (Yjs binary format)
- **Preview:** Server-Sent Events for live reload
- **Packaging:** archiver (ZIP export), marked (Markdown)
- **Deploy:** Docker Compose

## Limitations

- No authentication — anyone with the URL can edit (suitable for local/Tailscale networks)
- No horizontal scaling — single server instance
- No file watching — terminal file changes require manual scan
- No LSP server — uses Monaco's built-in TypeScript/JavaScript intelligence only
- Closing browser tab while offline loses unsaved edits (no IndexedDB persistence yet)

## License

MIT
