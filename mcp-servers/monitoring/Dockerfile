# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files from the correct path explicitly
COPY mcp-servers/monitoring/package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code from the correct path explicitly
COPY mcp-servers/monitoring/server.js ./
COPY mcp-servers/monitoring/config.js ./

# Create logs directory if logging to file is enabled
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S monitoring -u 1001

# Change ownership of app directory
RUN chown -R monitoring:nodejs /app
USER monitoring

# Expose health check port
EXPOSE 8080

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]
