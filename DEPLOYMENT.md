# SyncDev — Production Deployment

This guide covers deploying SyncDev to a single VPS with Docker Compose, TLS,
authentication and the sandboxed terminal.

## Architecture

```
                 ┌────────────────────────── VPS ──────────────────────────┐
   Internet ───► │  Caddy (:80/:443, auto-TLS)                             │
                 │     ├── /api/*, /preview*, WS  ──►  collab (:4000)       │
                 │     └── everything else        ──►  web (Next.js :3000)  │
                 │  collab ──(docker.sock)──► ephemeral sandbox containers  │
                 │  data: snapshots/ + workspaces/ (host volume)           │
                 └─────────────────────────────────────────────────────────┘
```

Only Caddy is exposed to the internet; `web` and `collab` stay on the internal
network.

## Prerequisites

- A VPS (2 vCPU / 2–4 GB RAM is a sane starting point) running Linux.
- Docker Engine + Docker Compose plugin.
- A domain name with a DNS A/AAAA record pointing at the server.
- A GitHub OAuth app (for login).

## 1. Configure

```bash
git clone <your-repo> syncdev && cd syncdev/infra
cp .env.example .env
$EDITOR .env
```

Fill in every value in `.env`. Generate the secrets fresh:

```bash
openssl rand -base64 33   # AUTH_SECRET
openssl rand -hex 32      # COLLAB_JWT_SECRET  (used by BOTH web and collab)
```

Create the GitHub OAuth app (https://github.com/settings/developers):

- **Homepage URL:** `https://YOUR_DOMAIN`
- **Authorization callback URL:** `https://YOUR_DOMAIN/api/auth/callback/github`

Create the data directory referenced by `SYNCDEV_DATA_DIR`:

```bash
sudo mkdir -p /srv/syncdev/data/{snapshots,workspaces}
```

## 2. Launch

```bash
cd infra
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Caddy obtains a TLS certificate automatically on first request. Check status:

```bash
docker compose -f docker-compose.prod.yml ps
curl -fsS https://YOUR_DOMAIN/health     # -> {"status":"ok"}
```

## Security model

| Layer | Control |
|-------|---------|
| Transport | TLS terminated by Caddy (auto Let's Encrypt) |
| Origin | `ALLOWED_ORIGINS` allowlist (no wildcard in prod) |
| AuthN | GitHub OAuth via Auth.js; short-lived HS256 token verified by collab |
| AuthZ | Per-project ownership (TOFU) + membership checks on REST and WS |
| Input | All API payloads validated with zod; path-traversal blocked |
| Abuse | Rate limiting on terminal/clone/upload/scan |
| Code exec | Terminal commands run in locked-down ephemeral Docker containers |

### ⚠️ About the Docker socket

The terminal sandbox runs each command in a throwaway container. To create
those containers, the `collab` service is given access to the host Docker
socket (`/var/run/docker.sock`). **Access to the Docker socket is equivalent to
root on the host.** Mitigations in place:

- collab is not exposed to the internet (only via Caddy, behind auth).
- Sandbox containers drop all capabilities, run as non-root, use a read-only
  root filesystem, and have memory/cpu/pids limits.

For stronger isolation, run sandbox containers under a rootless Docker daemon or
gVisor (`runsc`), or move the sandbox to a dedicated worker host. If you do not
need the terminal, set `TERMINAL_SANDBOX_DOCKER=false` and remove the socket
mount.

## Backups

All durable state lives under `SYNCDEV_DATA_DIR`:

- `snapshots/` — Yjs document state (the source of truth for file contents).
- `workspaces/` — checked-out files used by git/terminal.
- `memberships.json` — project ownership/membership.

Snapshot it regularly, e.g. nightly:

```bash
tar czf "syncdev-$(date +%F).tgz" -C /srv/syncdev data
# then copy off-site (S3, rsync, etc.)
```

## Updating

```bash
git pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build
```

Health checks gate the rollout: `web` and Caddy wait for `collab` to report
healthy before receiving traffic.

## Operations

- **Logs:** `docker compose -f docker-compose.prod.yml logs -f collab` (structured JSON via pino).
- **Liveness:** `GET /health`. **Readiness:** `GET /ready`.
- **Tune limits:** `SANDBOX_MEMORY`, `SANDBOX_CPUS`, `RATE_LIMIT_MAX`, etc. See
  `services/collab/.env.example` for the full list.

## Local development

Auth and the Docker sandbox are **off** by default locally, so the app runs with
zero extra setup:

```bash
npm install
npm run dev      # web on :3000, collab on :4000
```

To exercise auth/sandbox locally, set the corresponding flags in
`apps/web/.env.local` and `services/collab/.env`.
