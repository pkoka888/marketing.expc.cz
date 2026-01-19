# Multi-stage build for Redis MCP Server
# Stage 1: Builder stage for dependencies
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /app

# Copy package files
COPY mcp-servers/redis/package*.json ./

# Copy local kilo-code library (dependency)
COPY lib/kilo-code ./lib/kilo-code

# Install all dependencies (including dev dependencies for building)
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Stage 2: Security hardening stage
FROM node:20-alpine AS security

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Install security updates and required packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    dumb-init \
    su-exec \
    && \
    rm -rf /var/cache/apk/*

# Stage 3: Production stage
FROM node:20-alpine AS production

# Import security updates from security stage
COPY --from=security /usr/bin/dumb-init /usr/bin/dumb-init
COPY --from=security /sbin/su-exec /sbin/su-exec

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/lib ./lib

# Copy application code
COPY --chown=nodejs:nodejs mcp-servers/redis/ .

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node health-server.js --health-check || exit 1

# Expose health check port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command - can be overridden for health checks
CMD ["node", "server.js"]
