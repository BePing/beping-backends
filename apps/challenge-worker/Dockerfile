# syntax=docker/dockerfile:1.4

ARG NODE_VERSION=26.5.0-alpine

FROM --platform=$BUILDPLATFORM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN npm install -g pnpm@11.15.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY nest-cli.json tsconfig*.json prisma.config.ts ./
COPY apps ./apps
COPY libs ./libs
COPY prisma ./prisma
RUN pnpm prisma:generate && pnpm build:challenge-worker

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    DB_POOL_MAX=1
RUN npm install -g pnpm@11.15.1 \
    && apk add --no-cache dumb-init openssl
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist/apps/challenge-worker ./dist/apps/challenge-worker
COPY --from=builder /app/libs/common/src/generated/prisma ./libs/common/src/generated/prisma
USER node
ENTRYPOINT ["dumb-init", "--", "node", "dist/apps/challenge-worker/main.js"]
CMD ["idle"]
