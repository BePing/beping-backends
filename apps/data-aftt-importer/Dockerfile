# syntax=docker/dockerfile:1.4

ARG NODE_VERSION=20.19.0-alpine

# ──────────────────────────────────────────────
# base — node + pnpm (via npm; pnpm 11 needs node:sqlite / Node 22+)
# ──────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.34.3
WORKDIR /usr/src/app

# ──────────────────────────────────────────────
# deps — full install (dev+prod) with native toolchain, for building
# ──────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache python3 make g++ libc6-compat openssl
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ──────────────────────────────────────────────
# builder — generate Prisma client + compile this app
# ──────────────────────────────────────────────
FROM deps AS builder
COPY nest-cli.json tsconfig*.json prisma.config.ts ./
COPY libs/ ./libs/
COPY prisma/ ./prisma/
RUN pnpm exec prisma generate
COPY apps/ ./apps/
RUN pnpm run build:data-aftt-importer

# ──────────────────────────────────────────────
# prod-deps — production-only node_modules (flat, hoisted)
# ──────────────────────────────────────────────
FROM base AS prod-deps
RUN apk add --no-cache python3 make g++ libc6-compat openssl
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

# ──────────────────────────────────────────────
# production — minimal runtime
# ──────────────────────────────────────────────
FROM node:${NODE_VERSION} AS production

RUN apk add --no-cache dumb-init openssl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nestjs -u 1001

WORKDIR /usr/src/app

COPY --from=prod-deps --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist/apps/data-aftt-importer ./dist/apps/data-aftt-importer
COPY --chown=nestjs:nodejs package.json ./
COPY --chown=nestjs:nodejs apps/data-aftt-importer/start.sh ./start.sh
RUN chmod +x ./start.sh

USER nestjs

# No EXPOSE: this app is a Redis microservice (Transport.REDIS) with no HTTP
# server, so liveness is checked by process presence rather than an HTTP probe.
HEALTHCHECK --interval=60s --timeout=10s --start-period=10s --retries=3 \
    CMD pgrep node > /dev/null || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]
