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
RUN npm run build:app-notifications

RUN npm prune --omit=dev --legacy-peer-deps

# ──────────────────────────────────────────────
FROM node:${NODE_VERSION} AS production

RUN apk add --no-cache dumb-init openssl wget \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nestjs -u 1001

WORKDIR /usr/src/app

COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist/apps/app-notifications ./dist/apps/app-notifications
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/package.json ./

COPY --chown=nestjs:nodejs apps/app-notifications/start.sh ./start.sh
RUN chmod +x ./start.sh

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]
