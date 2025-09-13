# Build stage
ARG NODE_VERSION=20.18.0-alpine
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

# Install dependencies
RUN npm install --legacy-peer-deps && \
    npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client and build application
RUN npm run prisma:generate && \
    npm run build:data-aftt-importer

# Production stage
FROM node:${NODE_VERSION} AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache \
    dumb-init \
    openssl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nestjs -u 1001

# Create app directory
WORKDIR /usr/src/app

# Copy package files first for production install
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/prisma ./prisma

# Install only production dependencies and Prisma CLI
RUN npm install --omit=dev --legacy-peer-deps && \
    npm install -g prisma@latest && \
    npm cache clean --force

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules/.prisma ./node_modules/.prisma

# Copy startup script
COPY --chown=nestjs:nodejs apps/data-aftt-importer/start.sh ./start.sh

# Create logs directory and make startup script executable
RUN mkdir -p /usr/src/app/logs && \
    chmod +x /usr/src/app/start.sh && \
    chown -R nestjs:nodejs /usr/src/app

# Switch to non-root user
USER nestjs

# Expose port (if needed for health checks or metrics)
EXPOSE 3001

# Health check for background service
HEALTHCHECK --interval=60s --timeout=10s --start-period=10s --retries=3 \
    CMD pgrep node > /dev/null || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]
