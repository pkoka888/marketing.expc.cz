# Redis MCP Server

A high-performance, production-ready MCP (Model Context Protocol) server for Redis cache management and monitoring with advanced reliability features.

## Features

### 🚀 **Optimized Architecture**

- **Circuit Breaker**: Automatic failure detection and recovery
- **Retry Logic**: Exponential backoff retry with configurable parameters
- **Timeout Management**: Configurable timeouts for connections and operations
- **Structured Logging**: Comprehensive logging with correlation IDs
- **Health Checks**: Built-in health monitoring and readiness checks

### 🔧 **Configuration Management**

- **Environment-based Configuration**: Flexible configuration via environment variables
- **Schema Validation**: Zod-based configuration validation with defaults
- **Hot Reloading**: Configuration updates without restart

### 🐳 **Docker Optimization**

- **Multi-stage Builds**: Optimized Docker images with security hardening
- **Non-root Execution**: Security best practices with dedicated user
- **Health Checks**: Docker-native health monitoring
- **Resource Limits**: Configurable CPU and memory limits

### 📊 **Monitoring & Observability**

- **Health Endpoints**: `/health`, `/ready`, `/health/detailed`
- **Metrics Collection**: Performance and error metrics
- **Circuit Breaker Stats**: Real-time circuit breaker monitoring
- **Structured Logs**: JSON-formatted logs with correlation IDs

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and navigate to the project:**

   ```bash
   cd mcp-servers/redis
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env with your Redis connection details
   ```

3. **Start the services:**

   ```bash
   docker-compose up -d
   ```

4. **Check health:**
   ```bash
   curl http://localhost:3000/health
   ```

### Manual Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start the server:**

   ```bash
   npm start
   ```

4. **Start health checks (optional):**
   ```bash
   npm run health
   ```

## Configuration

### Environment Variables

#### Redis Connection

```bash
REDIS_HOST=localhost          # Redis server host
REDIS_PORT=6379              # Redis server port
REDIS_PASSWORD=              # Redis password (optional)
REDIS_DB=0                   # Redis database number
REDIS_USERNAME=              # Redis username (optional)
REDIS_TLS=false              # Enable TLS connection
REDIS_CLUSTER=false          # Enable cluster mode
```

#### Server Configuration

```bash
SERVER_NAME=redis-mcp-server    # Server name
SERVER_VERSION=1.0.0           # Server version
LOG_LEVEL=info                 # Logging level (debug, info, warn, error)
ENABLE_HEALTH_CHECKS=true      # Enable health check server
HEALTH_CHECK_PORT=3000         # Health check server port
```

#### Circuit Breaker

```bash
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5      # Failures before opening circuit
CIRCUIT_BREAKER_RECOVERY_TIMEOUT=60000   # Recovery timeout in ms
CIRCUIT_BREAKER_MONITORING_PERIOD=10000  # Monitoring period in ms
```

#### Retry Configuration

```bash
RETRY_MAX_RETRIES=3           # Maximum retry attempts
RETRY_BASE_DELAY=1000         # Base delay between retries (ms)
RETRY_MAX_DELAY=10000         # Maximum delay between retries (ms)
RETRY_BACKOFF_MULTIPLIER=2    # Exponential backoff multiplier
```

#### Timeouts

```bash
CONNECTION_TIMEOUT=5000       # Redis connection timeout (ms)
OPERATION_TIMEOUT=10000       # Redis operation timeout (ms)
HEALTH_CHECK_TIMEOUT=1000     # Health check timeout (ms)
```

## API Reference

### MCP Tools

#### `connect`

Connect to a Redis instance.

**Parameters:**

- `host` (string): Redis host (default: localhost)
- `port` (number): Redis port (default: 6379)
- `password` (string, optional): Redis password
- `db` (number): Redis database number (default: 0)

#### `get`

Get a value from Redis by key.

**Parameters:**

- `key` (string): Redis key

**Returns:**

- `key`: The requested key
- `value`: The value (null if not found)
- `ttl`: Time to live or "no expiration"
- `exists`: Boolean indicating if key exists

#### `set`

Set a value in Redis with optional TTL.

**Parameters:**

- `key` (string): Redis key
- `value` (string): Value to set
- `ttl` (number, optional): TTL in seconds

#### `delete`

Delete a key from Redis.

**Parameters:**

- `key` (string): Redis key to delete

#### `keys`

Get keys matching a pattern.

**Parameters:**

- `pattern` (string): Key pattern (default: "\*")

#### `info`

Get Redis server information.

**Parameters:**

- `section` (enum, optional): Info section (server, clients, memory, etc.)

#### `monitor_cache`

Monitor cache performance and statistics.

**Parameters:**

- `duration` (number): Monitoring duration in seconds (10-3600)

#### `flush_db`

Flush the current database.

**Parameters:**

- `confirm` (boolean): Confirmation flag (must be true)

### Health Check Endpoints

#### `GET /health`

Basic health check returning overall status.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "redis": { "status": "healthy", "responseTime": 5 },
    "memory": { "status": "healthy", "usage": { "heapUsed": 50 } },
    "uptime": { "status": "healthy", "uptime": 3600 }
  }
}
```

#### `GET /ready`

Readiness check for load balancer integration.

#### `GET /health/detailed`

Detailed health check with metrics and performance data.

## Architecture

### Components

1. **Configuration Manager**: Zod-based configuration validation
2. **Logger**: Structured logging with correlation IDs
3. **Circuit Breaker**: Failure detection and automatic recovery
4. **Retry Handler**: Exponential backoff retry logic
5. **Timeout Handler**: Configurable operation timeouts
6. **Health Check Server**: Express-based health monitoring
7. **MCP Server**: Model Context Protocol server implementation

### Error Handling

The server implements comprehensive error handling:

- **Custom Error Types**: `RedisConnectionError`, `RedisOperationError`
- **Graceful Degradation**: Circuit breaker prevents cascade failures
- **Automatic Recovery**: Retry logic with exponential backoff
- **Structured Logging**: All errors logged with context and correlation IDs

### Security Features

- **Non-root Docker execution**
- **Minimal attack surface** (Alpine Linux base)
- **No privileged containers**
- **Read-only filesystems** where possible
- **Resource limits** to prevent DoS attacks

## Monitoring

### Health Checks

The server provides multiple health check endpoints:

- **`/health`**: Overall system health
- **`/ready`**: Readiness for traffic
- **`/health/detailed`**: Comprehensive health metrics

### Metrics

Health checks provide metrics on:

- Redis connection status and response times
- Memory usage and performance
- Circuit breaker state
- Error rates and retry counts
- System uptime and resource usage

### Logging

All operations are logged with:

- **Correlation IDs**: Trace requests across components
- **Structured Data**: JSON-formatted logs
- **Log Levels**: Configurable verbosity
- **Performance Metrics**: Operation timing and success rates

## Development

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

### Building Docker Image

```bash
docker build -t redis-mcp-server .
```

### Docker Compose Development

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check Redis server is running
   - Verify connection parameters
   - Check network connectivity

2. **Circuit Breaker Open**
   - Check Redis server health
   - Review error logs for root cause
   - Circuit breaker will auto-recover

3. **Health Check Failures**
   - Verify health check port is accessible
   - Check Redis connectivity from container
   - Review health check logs

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

### Health Check Debugging

Test health checks manually:

```bash
curl -v http://localhost:3000/health
curl -v http://localhost:3000/health/detailed
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
