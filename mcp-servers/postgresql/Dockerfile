# Multi-stage Docker build for PostgreSQL MCP Server
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files from the correct path explicitly
COPY mcp-servers/postgresql/package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --only=production=false

# Copy source code from the correct path explicitly
COPY mcp-servers/postgresql/server.js ./
COPY mcp-servers/postgresql/config.js ./
COPY mcp-servers/postgresql/logger.js ./
COPY mcp-servers/postgresql/database.js ./
COPY mcp-servers/postgresql/health-server.js ./

# Build application (if needed)
RUN npm run build 2>/dev/null || echo "No build script found"

# Stage 2: Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S postgresmcp -u 1001

# Create app directory
WORKDIR /app

# Copy package files
COPY mcp-servers/postgresql/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/server.js ./
COPY --from=builder /app/config.js ./
COPY --from=builder /app/logger.js ./
COPY --from=builder /app/database.js ./
COPY --from=builder /app/health-server.js ./

# Create logs directory
RUN mkdir -p logs && \
    chown -R postgresmcp:nodejs /app

# Switch to non-root user
USER postgresmcp

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]
