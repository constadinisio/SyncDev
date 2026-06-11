# Build context: repo root (so the root package-lock.json is available for npm ci)
# docker compose sets: build.context: .. and dockerfile: services/collab/Dockerfile

FROM node:20-alpine

# docker-cli lets the terminal sandbox spawn sibling containers via the host
# Docker socket (mounted at runtime). git/bash support common workspace tasks.
RUN apk add --no-cache docker-cli git bash

WORKDIR /app

# ── Layer 1: dependency manifests ──────────────────────────────────────────
# Copy the root package.json + lockfile and both workspace package.json files.
# This layer is invalidated only when dependency specs change, not source.
COPY package.json package-lock.json ./
COPY services/collab/package.json ./services/collab/package.json
COPY apps/web/package.json ./apps/web/package.json

# Install exact versions from the lockfile (reproducible, no network variance)
RUN npm ci

# ── Layer 2: source + build ────────────────────────────────────────────────
COPY services/collab/ ./services/collab/

RUN npm -w services/collab run build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "services/collab/dist/server.js"]
