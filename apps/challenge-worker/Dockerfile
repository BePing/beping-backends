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

FROM node:${NODE_VERSION} AS prod-deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN npm install -g pnpm@11.15.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    DB_POOL_MAX=1
RUN apk add --no-cache dumb-init openssl
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --from=builder /app/dist/apps/challenge-worker ./dist/apps/challenge-worker
COPY --from=builder /app/libs/common/src/generated/prisma ./libs/common/src/generated/prisma
USER node
ENTRYPOINT ["dumb-init", "--", "node", "dist/apps/challenge-worker/main.js"]
CMD ["idle"]
