FROM node:26-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY nest-cli.json tsconfig*.json ./
COPY apps ./apps
COPY libs ./libs
COPY prisma ./prisma
RUN pnpm prisma:generate && pnpm build:challenge-worker

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    DB_POOL_MAX=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist/apps/challenge-worker ./dist/apps/challenge-worker
COPY --from=builder /app/libs/common/src/generated/prisma ./libs/common/src/generated/prisma
USER node
ENTRYPOINT ["node", "dist/apps/challenge-worker/main.js"]
CMD ["idle"]
