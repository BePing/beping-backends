# syntax=docker/dockerfile:1.4

ARG NODE_VERSION=20.19.0-alpine
FROM node:${NODE_VERSION} AS builder

RUN apk add --no-cache openssl python3 make g++ libc6-compat

WORKDIR /usr/src/app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --ignore-scripts && \
    npm rebuild

COPY prisma/ ./prisma/
RUN npx prisma generate

COPY nest-cli.json tsconfig*.json ./
COPY apps/ ./apps/
RUN npm run build:data-aftt-importer

RUN npm prune --omit=dev --legacy-peer-deps

# ──────────────────────────────────────────────
FROM node:${NODE_VERSION} AS production

RUN apk add --no-cache dumb-init openssl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nestjs -u 1001

WORKDIR /usr/src/app

COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist/apps/data-aftt-importer ./dist/apps/data-aftt-importer
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/package.json ./

COPY --chown=nestjs:nodejs apps/data-aftt-importer/start.sh ./start.sh
RUN chmod +x ./start.sh

USER nestjs

# No EXPOSE: this app is a Redis microservice (Transport.REDIS) with no HTTP
# server, so liveness is checked by process presence rather than an HTTP probe.
HEALTHCHECK --interval=60s --timeout=10s --start-period=10s --retries=3 \
    CMD pgrep node > /dev/null || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]
