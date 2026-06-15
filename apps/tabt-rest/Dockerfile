# syntax=docker/dockerfile:1.4

# ──────────────────────────────────────────────
# Build stage — shared npm ci + prisma + compile
# ──────────────────────────────────────────────
ARG NODE_VERSION=20.19.0-alpine
FROM node:${NODE_VERSION} AS builder

RUN apk add --no-cache openssl python3 make g++ libc6-compat

WORKDIR /usr/src/app

# 1. Install deps (layer cached unless package*.json changes)
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --ignore-scripts && \
    npm rebuild

# 2. Generate Prisma client
COPY prisma/ ./prisma/
RUN npx prisma generate

# 3. Build this app only
COPY nest-cli.json tsconfig*.json ./
COPY apps/ ./apps/
RUN npm run build:tabt-rest

# 4. Prune to production deps only
RUN npm prune --omit=dev --legacy-peer-deps

# ──────────────────────────────────────────────
# Production stage — minimal runtime
# ──────────────────────────────────────────────
FROM node:${NODE_VERSION} AS production

RUN apk add --no-cache dumb-init openssl wget \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nestjs -u 1001

WORKDIR /usr/src/app

# Copy only production node_modules (no devDeps)
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules

# Copy built app + prisma schema/migrations
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist/apps/tabt-rest ./dist/apps/tabt-rest
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/package.json ./

# Startup script
COPY --chown=nestjs:nodejs apps/tabt-rest/start.sh ./start.sh
RUN chmod +x ./start.sh

USER nestjs

EXPOSE 3050

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3050/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]
