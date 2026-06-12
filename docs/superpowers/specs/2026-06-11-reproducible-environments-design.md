# Reproducible Environments (devcontainers) — Design

- **Date:** 2026-06-11
- **Status:** Approved (pending implementation plan)
- **Topic:** Per-project reproducible development environments for SyncDev

## Context

SyncDev is a browser-based collaborative IDE (Yjs/CRDT, Monaco, terminal
sandboxed in ephemeral Docker, git CLI, static preview). Today, terminal
commands run in an **ephemeral, run-to-completion Docker container per
command** using a single fixed image (`SANDBOX_IMAGE`). There is no notion of a
per-project environment: globally-installed tools (apt packages, global npm
installs, runtime versions) do not persist between commands — only the
bind-mounted workspace on disk does.

This is the first of several "Firebase Studio parity" features. It was chosen
as the foundation because the next feature (live preview of a running dev
server) requires a persistent, long-lived environment.

## Goals

- Each project declares its environment **declaratively, versioned in the
  repo**, so every collaborator and a fresh clone get the same setup.
- Adopt the **devcontainer specification** (`.devcontainer/devcontainer.json`)
  so the environment is reproducible and portable **outside** SyncDev too
  (VS Code, Codespaces).
- Run project commands inside a **persistent per-project container** so global
  tooling and state persist between commands.
- Manage the environment lifecycle automatically (lazy start, idle stop)
  reusing the existing presence tracking.

## Non-goals (explicitly out of scope for this spec)

- **Long-running processes / dev servers and output streaming.** Commands
  remain request/response, run-to-completion with a timeout. The persistent
  container enables dev servers, but that is the *next* feature (live preview).
- **Custom image builds** (`Dockerfile` / `build` in devcontainer.json). MVP
  supports a **prebuilt `image` + `postCreateCommand`** only.
- Devcontainer **Features** (the `features` key), lifecycle hooks beyond
  `postCreateCommand`, and `dockerComposeFile`.

## Key decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Definition format | devcontainer spec (`.devcontainer/devcontainer.json`) | Industry standard, portable beyond SyncDev |
| Execution model | Persistent container per project | Only model where global state persists; foundation for dev-server preview |
| Image scope (MVP) | Prebuilt `image` + `postCreateCommand` | Covers most cases without a build/cache/registry pipeline |
| Idle strategy | `docker stop` (keep), not `rm` | Preserves global state across sessions; avoids re-running setup |

## Architecture

New subsystem in the collab service under `services/collab/src/environments/`.

### Components

1. **`devcontainer-config.ts`** — reads and validates
   `.devcontainer/devcontainer.json` from the project workspace with a zod
   schema. Resolves a normalized config: `image`, `postCreateCommand`,
   `forwardPorts`, `containerEnv`, `remoteUser`, `workspaceFolder`. Falls back
   to a default config (universal image) when the file is absent.
   **Security whitelist:** only the fields above are honored; any other field
   (notably `privileged`, host mounts, `runArgs`, `--network host`,
   `dockerComposeFile`, `features`) is **ignored**.

2. **`docker-driver.ts`** — a thin `DockerDriver` interface
   (`run / exec / stop / start / rm / pull / inspect`). The real
   implementation shells out to the `docker` CLI (already present in the collab
   image); a fake implementation backs unit tests. This abstraction keeps the
   manager fully unit-testable without a daemon.

3. **`environment-manager.ts`** — the core. A registry
   `Map<projectId, EnvironmentState>` holding container name, status
   (`stopped | building | running | error`), resolved config, last-activity
   timestamp, and a `setupFailed` flag. Methods:
   - `ensureRunning(projectId)` — lazy start (see Lifecycle).
   - `exec(projectId, command, timeoutMs)` — `docker exec` into the running
     container; returns `{ stdout, stderr, exitCode }`.
   - `stop(projectId)` / `rebuild(projectId)` / `status(projectId)`.
   - Enforces `MAX_ACTIVE_ENVIRONMENTS` (evicts the longest-idle environment,
     or returns a clear error if none can be evicted).

4. **`lifecycle.ts`** — subscribes to the `room-manager` client-presence
   signal. When a project's last client disconnects, starts an `ENV_IDLE_MS`
   timer; on expiry, calls `stop(projectId)`. Cancels the timer if a client
   reconnects.

### Integration points

- **Terminal** (`services/collab/src/api/terminal.ts`): when environments are
  enabled, route commands through `environmentManager.exec(...)` instead of the
  ephemeral `runInDocker`. Host exec remains the dev/no-Docker fallback.
- **REST API** (new, in `routes.ts`): `GET /api/env/:projectId` (status),
  `POST /api/env/:projectId/start|rebuild|stop`, and
  `GET /api/env/:projectId/events` (SSE status/log stream). All gated by the
  existing `authorize(pid)` membership check.
- **Web UI**: an **Environment panel/indicator** showing status
  (stopped/building/running/error), start/rebuild/stop actions, and the
  build/`postCreateCommand` log. A **"Create environment"** action scaffolds a
  `.devcontainer/devcontainer.json` from a preset when none exists.

## Lifecycle and state machine

States: `stopped → building → running → (idle) → stopped`, with `error` as a
side state.

`error` is reserved for failures that leave **no usable container** (image pull
failed, `docker run` failed, daemon unreachable). A `postCreateCommand` failure
is **not** `error`: the container is up and usable, so the status is `running`
with a `setupFailed: true` flag (the UI surfaces it and offers Rebuild).

### Start (lazy) — `ensureRunning(projectId)`

1. If `running` → return immediately. If `building` → await the in-flight
   promise (concurrent-call dedupe).
2. If `stopped`:
   1. Read + validate `devcontainer.json` (or default).
   2. Status → `building`; check `MAX_ACTIVE_ENVIRONMENTS` (evict idle or error).
   3. `docker pull` the image if missing.
   4. `docker run -d` a persistent container named `syncdev-env-<projectId>`,
      mounting the workspace at `workspaceFolder`, with cap-drop ALL,
      no-new-privileges, non-root `remoteUser`, memory/cpu/pids limits, network
      policy, and `containerEnv`.
   5. Run `postCreateCommand` once; mark a sentinel so it is not repeated on
      later `docker start`.
   6. Status → `running`; emit a status event to the UI.
3. Any failure → status `error` with captured logs.

### Command execution

`POST /api/terminal` → `ensureRunning` → `docker exec` → return
`{ stdout, stderr, exitCode }` (run-to-completion, timeout as today). Global
tooling/state persists between commands.

### Idle stop — `stop`, not `rm`

- On the last client's disconnect, start an `ENV_IDLE_MS` timer; on expiry,
  `docker stop` (the container is kept).
- On reopen, `docker start` (fast; `postCreateCommand` is **not** re-run).
- `docker rm` happens only on: explicit **Rebuild**, a detected change to
  `devcontainer.json` (UI marks "rebuild needed"), or eviction for
  `MAX_ACTIVE_ENVIRONMENTS`.

### Status → UI

`GET /api/env/:projectId/events` is an SSE stream (mirrors the existing
`preview-events` pattern) carrying status transitions and build/`postCreate`
log lines. The Environment panel subscribes.

## Configuration (new env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `DEVCONTAINER_DEFAULT_IMAGE` | `mcr.microsoft.com/devcontainers/javascript-node:20` | Used when no devcontainer.json |
| `MAX_ACTIVE_ENVIRONMENTS` | `5` | Cap on concurrent running environments (VPS protection) |
| `ENV_IDLE_MS` | `600000` (10 min) | Idle delay before stopping an environment |
| `ENVIRONMENTS_ENABLED` | `false` in dev / `true` in prod | Feature flag; falls back to host/ephemeral exec when off |

## Security

- Same hardening as the current ephemeral sandbox: cap-drop ALL,
  no-new-privileges, non-root user, memory/cpu/pids limits, restricted network.
- **Deliberate relaxation:** the persistent environment uses a **writable
  rootfs** (the ephemeral per-command container used read-only), because
  `postCreateCommand` installs software. Compensated by the remaining caps and
  authorization.
- **devcontainer.json is user-controlled** (lives in the repo), so it is
  arbitrary image/command execution — confined to the hardened container, same
  threat model as the terminal. The strict field whitelist (above) forbids
  dangerous escalation (`privileged`, host mounts, host network).
- All `/api/env/*` endpoints are gated by `authorize(pid)` (project
  membership). `containerEnv` values are never logged.
- Reuses `SANDBOX_HOST_WORKSPACE_BASE` for sibling-container bind-mount path
  translation when the collab service itself runs in a container.

## Error handling

- Invalid/malformed devcontainer.json → validation error surfaced to UI; env
  stays `stopped`; option to use the default.
- Image pull failure → status `error` + log + retry.
- `postCreateCommand` non-zero exit → container kept running and inspectable;
  UI shows `setupFailed` + logs + Rebuild.
- Docker daemon unreachable → clear "Docker unavailable" error (reuses
  `checkDockerAvailable`).
- Container died (OOM/crash) → detected via `docker inspect` on next
  `status`/`exec`; marked `stopped`; auto-restart on next `ensureRunning`.
- Concurrency: `building` dedupe via in-flight promise; rebuilds serialized;
  `MAX_ACTIVE_ENVIRONMENTS` enforced under a lock.

## Testing

- **Unit (vitest, no Docker):**
  - `devcontainer-config`: valid parse, absent → default, malformed → error,
    forbidden fields stripped.
  - `environment-manager` with the **fake `DockerDriver`**: `ensureRunning`
    dedupe, MAX eviction, stop/start transitions, error states, `setupFailed`.
  - `lifecycle` with fake timers + mocked manager.
  - Target the 80% coverage gate.
- **Integration (optional, gated):** runs against a real Docker daemon when
  available, skipped otherwise (same pattern as the E2E suite).

## Follow-ups (future specs)

- Live preview of a running dev server (port forwarding) — the feature this one
  unblocks.
- Custom image builds (`Dockerfile`/`build`) and devcontainer `features`.
- One-click deploy; expanded template catalog; env/secrets manager UI.

### Known gaps from the initial implementation (fast-follow)

These were specified but only partially implemented in the first cut; tracked
for a follow-up (surfaced by the final review):

- ~~**Crash auto-recovery:** `ensureRunning` short-circuits on the in-memory
  `running` status without re-inspecting, so a container that died (OOM/crash)
  is reported as `running` until idle-stop or restart.~~ **Done:** `ensureRunning`
  now `docker inspect`s a container it believes is running and restarts it via
  `start()` (which recreates if removed) when the container is gone.
- ~~**Build/postCreate log streaming:** the SSE hub is wired, but the manager only
  emits a `log` event on `setupFailed`, and the panel ignores `type:"log"`
  events.~~ **Done:** the `DockerDriver` now takes an optional `onLog` sink that
  streams `docker pull`/`exec` stdout+stderr line-by-line; the manager forwards
  those as `type:"log"` events during build/postCreate, and the panel renders
  them in a scrollable log area (cleared on each new build).
- **Minor:** ~~REST `/api/env/*` actions are not gated by `ENVIRONMENTS_ENABLED`
  (only terminal routing is)~~ (**done:** all `/api/env/*` routes 404 when the
  feature is disabled); devcontainer.json change detection ("rebuild needed");
  image-pull retry; await/serialize eviction before starting the new container.
