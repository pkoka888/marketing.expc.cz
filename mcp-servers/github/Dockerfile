# Multi-stage build for GitHub MCP Server
# Stage 1: Dependencies
FROM node:20-alpine AS deps
# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy local kilo-code library
COPY ../../lib/kilo-code ./lib/kilo-code

# Install dependencies
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy local kilo-code library
COPY ../../lib/kilo-code ./lib/kilo-code

# Install all dependencies (including dev dependencies for building)
RUN npm ci --ignore-scripts

# Copy source code
COPY server.js ./
COPY config.js ./

# Build stage (if needed in future)
# RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy installed dependencies from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy local kilo-code library
COPY --from=builder --chown=nodejs:nodejs /app/lib ./lib

# Copy built application
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs config.js ./

# Switch to non-root user
USER nodejs

# Expose port (not used for stdio server, but good practice)
EXPOSE 3000

# Health check (for when running as HTTP server in future)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD node -e "console.log('Health check passed')" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "server.js"]

# Labels for better container management
LABEL org.opencontainers.image.title="GitHub MCP Server" \
      org.opencontainers.image.description="Model Context Protocol server for GitHub API integration" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="MarketingPortal" \
      maintainer="dev@marketingportal.cz"
