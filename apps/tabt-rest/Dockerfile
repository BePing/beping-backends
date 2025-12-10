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

# Create app directory
WORKDIR /usr/src/app

# Copy package files for better caching
COPY package*.json ./
COPY prisma/ ./prisma/

# Install dependencies with memory limits
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm install --legacy-peer-deps && \
    npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client and build application
RUN npm run prisma:generate && \
    npm run build:tabt-rest

# Production stage
FROM node:${NODE_VERSION} AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache \
    dumb-init \
    openssl \
    wget \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nestjs -u 1001

# Create app directory
WORKDIR /usr/src/app

# Copy package files first for production install
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/prisma ./prisma

# Install only production dependencies and Prisma CLI
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm install --omit=dev --legacy-peer-deps && \
    npm install -g prisma@5.20.0 && \
    npm cache clean --force

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules/.prisma ./node_modules/.prisma

# Copy startup script
COPY --chown=nestjs:nodejs apps/tabt-rest/start.sh ./start.sh

# Create logs directory and make startup script executable
RUN mkdir -p /usr/src/app/logs && \
    chmod +x /usr/src/app/start.sh && \
    chown -R nestjs:nodejs /usr/src/app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3050

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3050/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]
