# syntax=docker/dockerfile:1.4

# Build stage
ARG NODE_VERSION=20.19.0-alpine
FROM node:${NODE_VERSION} AS builder

# Install build dependencies
RUN apk add --no-cache \
    openssl \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /usr/src/app

# Copy only package files first for better layer caching
COPY package*.json ./

# Use BuildKit cache mount for npm - persists across builds
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# Copy prisma schema and generate client
COPY prisma/ ./prisma/
RUN --mount=type=cache,target=/root/.npm \
    npm run prisma:generate

# Copy source code (only what's needed for build)
COPY nest-cli.json tsconfig*.json ./
COPY apps/data-aftt-importer/ ./apps/data-aftt-importer/
COPY libs/ ./libs/

# Build application
RUN npm run build:data-aftt-importer

# Prune devDependencies in place (faster than re-installing)
RUN npm prune --omit=dev --legacy-peer-deps

# Production stage
FROM node:${NODE_VERSION} AS production

# Install runtime dependencies only
RUN apk add --no-cache dumb-init openssl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nestjs -u 1001

WORKDIR /usr/src/app

# Copy pruned node_modules from builder (skip second npm install)
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules

# Copy built application and prisma
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/package.json ./

# Copy startup script and setup
COPY --chown=nestjs:nodejs apps/data-aftt-importer/start.sh ./start.sh
RUN chmod +x ./start.sh && mkdir -p /usr/src/app/logs

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=60s --timeout=10s --start-period=10s --retries=3 \
    CMD pgrep node > /dev/null || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]
