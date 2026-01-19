# Docker Fixes Documentation for MarketingPortal Project

This document summarizes all researched solutions for identified Docker issues in the MarketingPortal project, providing implementation details, code examples, and references to best practices.

## Table of Contents

1. [Redis MCP Server Module Dependency Issue](#redis-mcp-server-module-dependency-issue)
2. [Health Check Endpoint Problems](#health-check-endpoint-problems)
3. [PostgreSQL Memory Constraint Issues](#postgresql-memory-constraint-issues)

---

## 1. Redis MCP Server Module Dependency Issue

### Problem

The Redis MCP server has a local file dependency in its `package.json` that causes installation issues in Docker containers:

```json
"dependencies": {
  "kilo-code": "file:../../lib/kilo-code"
}
```

This local file reference fails during Docker builds because:

- The path `../../lib/kilo-code` doesn't exist in the Docker container context
- Docker builds run in isolated environments without access to the host filesystem
- The dependency cannot be resolved during `npm install` in the container

### Solution

Replace the file dependency with a proper package reference or implement build-time installation.

#### Option 1: Publish kilo-code as a Private Package

1. Publish the `kilo-code` library to a private npm registry
2. Update the dependency in `package.json`:

```json
"dependencies": {
  "kilo-code": "1.0.0"  // Version from your private registry
}
```

#### Option 2: Multi-stage Docker Build with Local Copy

Use a multi-stage Docker build to copy the local dependency during build:

```dockerfile
# Stage 1: Copy dependencies
FROM node:18-alpine as dependencies
WORKDIR /app

# Copy kilo-code from local context
COPY ../../lib/kilo-code ./kilo-code/

# Stage 2: Main build
FROM node:18-alpine
WORKDIR /app

# Copy only the necessary files from dependencies stage
COPY --from=dependencies /app/kilo-code ./kilo-code/

# Install dependencies
COPY package*.json ./
RUN npm install
```

#### Option 3: Use Docker Build Context Properly

Ensure the Docker build context includes the necessary directories:

```bash
# Build with proper context
docker build -f mcp-servers/redis/Dockerfile -t redis-server .
```

Then update the Dockerfile to copy the dependency:

```dockerfile
FROM node:18-alpine
WORKDIR /app

# Copy kilo-code from build context
COPY lib/kilo-code ./kilo-code/

# Install dependencies
COPY package*.json ./
RUN npm install
```

### Implementation Details

#### Updated Dockerfile Example

```dockerfile
# mcp-servers/redis/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy kilo-code from build context (requires proper build context)
COPY ../../lib/kilo-code ./kilo-code/

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy remaining files
COPY . .

# Build and start
CMD ["node", "server.js"]
```

#### Build Command

```bash
# Build from project root with proper context
docker build -f mcp-servers/redis/Dockerfile -t redis-server .
```

### Best Practices References

1. **Docker Build Context**: [Docker Documentation - Build Context](https://docs.docker.com/build/building/context/)
2. **Multi-stage Builds**: [Docker Documentation - Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
3. **Node.js Docker Best Practices**: [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

---

## 2. Health Check Endpoint Problems

### Problem

Health check endpoints across MCP servers are inconsistent or failing:

1. **Missing Health Checks**: Some servers don't implement health check endpoints
2. **Inconsistent Paths**: Different servers use different paths (`/health`, `/healthz`, `/status`)
3. **Incomplete Checks**: Some health checks only verify server status, not dependencies
4. **Docker Health Check Not Configured**: Missing `HEALTHCHECK` instructions in Dockerfiles

### Solution

Standardize health check implementations across all MCP servers with comprehensive dependency checking.

### Implementation Details

#### Standard Health Check Endpoint

Create a consistent health check endpoint in all servers:

```javascript
// Example: health-server.js
const express = require('express');
const app = express();

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = await checkDatabaseConnection();

    // Check Redis connection
    const redisStatus = await checkRedisConnection();

    // Check external API
    const apiStatus = await checkExternalAPI();

    if (dbStatus && redisStatus && apiStatus) {
      res.status(200).json({
        status: 'healthy',
        dependencies: {
          database: 'connected',
          redis: 'connected',
          externalAPI: 'available',
        },
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        dependencies: {
          database: dbStatus ? 'connected' : 'disconnected',
          redis: redisStatus ? 'connected' : 'disconnected',
          externalAPI: apiStatus ? 'available' : 'unavailable',
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

async function checkDatabaseConnection() {
  // Implement actual database connection check
  return true;
}

async function checkRedisConnection() {
  // Implement actual Redis connection check
  return true;
}

async function checkExternalAPI() {
  // Implement actual external API check
  return true;
}

module.exports = app;
```

#### Dockerfile Health Check Configuration

Add `HEALTHCHECK` instruction to Dockerfiles:

```dockerfile
# Health check configuration
HEALTHCHECK --interval=30s --timeout=3s \
  --start-period=5s \
  CMD curl -f http://localhost:3000/health || exit 1
```

#### Docker Compose Health Check

Configure health checks in docker-compose.yml:

```yaml
services:
  redis-server:
    build: ./mcp-servers/redis
    ports:
      - '3000:3000'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Best Practices References

1. **Docker Health Check**: [Docker Documentation - Health Check](https://docs.docker.com/engine/reference/builder/#healthcheck)
2. **Docker Compose Health Check**: [Docker Compose Health Check](https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck)
3. **Kubernetes Liveness/Readiness Probes**: [Kubernetes Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
4. **Health Check Best Practices**: [Health Check Best Practices](https://www.datadoghq.com/blog/monitoring-docker-health-checks/)

---

## 3. PostgreSQL Memory Constraint Issues

### Problem

PostgreSQL containers are experiencing memory-related issues:

1. **OOM Kills**: PostgreSQL process being killed by Docker when exceeding memory limits
2. **Performance Degradation**: Poor query performance due to insufficient memory allocation
3. **Configuration Issues**: Default PostgreSQL configuration not optimized for container environments
4. **Missing Resource Limits**: No memory constraints defined in Docker Compose

### Solution

Optimize PostgreSQL memory settings and configure proper resource constraints.

### Implementation Details

#### PostgreSQL Configuration Optimization

Create a custom `postgresql.conf` for container environments:

```conf
# postgresql.conf for containers
shared_buffers = 128MB           # 25% of available RAM
work_mem = 4MB                   # For sorting operations
effective_cache_size = 384MB     # 75% of available RAM
maintenance_work_mem = 32MB      # For maintenance operations
random_page_cost = 1.1           # Optimized for SSD
max_connections = 50             # Reduced for container environment
```

#### Docker Compose Resource Limits

Configure memory limits in docker-compose.yml:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: marketing
      POSTGRES_PASSWORD: securepassword
      POSTGRES_DB: marketing_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          memory: 256M
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U marketing']
      interval: 5s
      timeout: 5s
      retries: 5
```

#### Dockerfile Memory Optimization

For custom PostgreSQL images:

```dockerfile
FROM postgres:15-alpine

# Install additional tools
RUN apk add --no-cache procps

# Copy optimized configuration
COPY postgresql.conf /etc/postgresql/postgresql.conf

# Set memory limits
ENV POSTGRES_SHARED_BUFFERS=128MB
ENV POSTGRES_WORK_MEM=4MB
ENV POSTGRES_EFFECTIVE_CACHE_SIZE=384MB

# Health check script
COPY health-check.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/health-check.sh

HEALTHCHECK --interval=30s --timeout=3s \
  CMD /usr/local/bin/health-check.sh
```

#### Health Check Script

```bash
#!/bin/sh
# health-check.sh
pg_isready -U marketing -d marketing_db
```

### Best Practices References

1. **PostgreSQL Docker Official Image**: [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
2. **PostgreSQL Memory Configuration**: [PostgreSQL Memory Configuration](https://www.postgresql.org/docs/current/runtime-config-resource.html)
3. **Docker Resource Limits**: [Docker Resource Limits](https://docs.docker.com/config/containers/resource_constraints/)
4. **PostgreSQL Performance Tuning**: [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)
5. **Containerized PostgreSQL Best Practices**: [Containerized PostgreSQL Best Practices](https://www.crunchydata.com/blog/running-postgresql-in-containers-best-practices)

---

## Summary of Recommendations

1. **Redis Dependency**: Use multi-stage builds or proper build context to handle local dependencies
2. **Health Checks**: Implement consistent `/health` endpoints with comprehensive dependency checking
3. **PostgreSQL Memory**: Configure appropriate memory limits and optimize PostgreSQL settings for containers

## Implementation Checklist

- [ ] Update Redis MCP server Dockerfile with proper dependency handling
- [ ] Standardize health check endpoints across all MCP servers
- [ ] Add HEALTHCHECK instructions to all Dockerfiles
- [ ] Configure PostgreSQL memory limits in docker-compose.yml
- [ ] Create optimized postgresql.conf for container environment
- [ ] Test all health checks and memory configurations

## References

- Docker Documentation: <https://docs.docker.com/>
- PostgreSQL Documentation: <https://www.postgresql.org/docs/>
- Node.js Docker Best Practices: <https://github.com/nodejs/docker-node>
- 12 Factor App: <https://12factor.net/>
