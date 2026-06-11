# Build context: repo root (so the root package-lock.json is available for npm ci)
# docker compose sets: build.context: .. and dockerfile: apps/web/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app

# ── Layer 1: dependency manifests ──────────────────────────────────────────
# Copy the root package.json + lockfile and both workspace package.json files.
# This layer is invalidated only when dependency specs change, not source.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY services/collab/package.json ./services/collab/package.json

# Install exact versions from the lockfile (reproducible, no network variance)
RUN npm ci

# ── Layer 2: source + build ────────────────────────────────────────────────
COPY apps/web/ ./apps/web/

# NEXT_PUBLIC_* are inlined at build time, so they must be provided as build
# args (not just runtime env). Behind the Caddy proxy these point at the public
# domain on the same origin (https/wss), where /api and WS upgrades are routed
# to the collab service.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_COLLAB_WS_URL
ARG NEXT_PUBLIC_AUTH_ENABLED
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_COLLAB_WS_URL=$NEXT_PUBLIC_COLLAB_WS_URL \
    NEXT_PUBLIC_AUTH_ENABLED=$NEXT_PUBLIC_AUTH_ENABLED

RUN npm -w apps/web run build

# ── Runner: minimal standalone image ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# next build with output:"standalone" emits a self-contained server.js bundle.
# Static assets and public files are copied separately (not included in standalone).
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
