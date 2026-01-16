# PostgreSQL MCP Server

An optimized Model Context Protocol (MCP) server for PostgreSQL database management and monitoring with comprehensive error handling, logging, and Docker optimization.

## Features

### Core Functionality

- **Database Connection Management**: Secure connection pooling with configurable parameters
- **Query Execution**: Safe SQL query execution with parameter binding
- **Schema Inspection**: Retrieve table schemas, columns, and database metadata
- **Performance Monitoring**: Real-time database performance metrics and statistics
- **Backup/Restore**: Database backup and restore operations (command-based)

### Advanced Architecture

- **Configuration Management**: Centralized configuration with environment variable validation
- **Structured Logging**: Winston-based logging with multiple transports and log levels
- **Circuit Breaker**: Automatic failure detection and recovery for database operations
- **Retry Logic**: Exponential backoff retry mechanism for transient failures
- **Error Handling**: Comprehensive error classification and recovery strategies
- **Health Checks**: HTTP-based health monitoring with detailed system status
- **Graceful Shutdown**: Proper cleanup of connections and resources on termination

### Docker Optimization

- **Multi-stage Build**: Optimized Docker images with security hardening
- **Non-root User**: Runs with minimal privileges for security
- **Health Checks**: Container health monitoring with automatic restarts
- **Volume Management**: Persistent data and log storage

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and navigate to the project**:

   ```bash
   cd mcp-servers/postgresql
   ```

2. **Start the services**:

   ```bash
   docker-compose up -d
   ```

3. **Check health status**:

   ```bash
   curl http://localhost:3001/health
   ```

### Manual Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Configure environment** (optional):

   ```bash
   cp .env.example .env
   # Edit .env with your database settings
   ```

3. **Start the server**:

   ```bash
   npm start
   ```

## Configuration

### Environment Variables

| Variable                | Default           | Description                              |
| ----------------------- | ----------------- | ---------------------------------------- |
| `DB_HOST`               | `localhost`       | PostgreSQL host                          |
| `DB_PORT`               | `5432`            | PostgreSQL port                          |
| `DB_NAME`               | `marketingportal` | Database name                            |
| `DB_USER`               | `postgres`        | Database user                            |
| `DB_PASSWORD`           | -                 | Database password                        |
| `DB_MAX_CONNECTIONS`    | `20`              | Maximum pool connections                 |
| `LOG_LEVEL`             | `info`            | Logging level (error, warn, info, debug) |
| `CB_FAILURE_THRESHOLD`  | `5`               | Circuit breaker failure threshold        |
| `RETRY_MAX_ATTEMPTS`    | `3`               | Maximum retry attempts                   |
| `HEALTH_CHECKS_ENABLED` | `true`            | Enable health check endpoints            |

### Health Check Endpoints

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health status with metrics
- `GET /ready` - Readiness probe
- `GET /live` - Liveness probe
- `GET /metrics` - Prometheus-compatible metrics

## MCP Tools

### Database Operations

- `connect` - Establish database connection
- `execute_query` - Execute SQL queries with parameters
- `get_tables` - List tables in a schema
- `get_table_schema` - Get detailed table schema
- `get_database_info` - Retrieve database statistics

### Monitoring & Management

- `monitor_performance` - Real-time performance monitoring
- `backup_database` - Prepare database backup
- `restore_database` - Prepare database restore

## Architecture Components

### Database Manager (`database.js`)

- Connection pooling with pg.Pool
- Circuit breaker pattern implementation
- Retry logic with exponential backoff
- Health monitoring and automatic recovery

### Logger (`logger.js`)

- Structured logging with Winston
- Multiple output transports (console, file)
- Performance and error tracking
- Configurable log levels and formats

### Health Server (`health-server.js`)

- HTTP server for health endpoints
- System resource monitoring
- Database connectivity checks
- Prometheus metrics export

### Configuration (`config.js`)

- Joi-based validation
- Environment variable mapping
- Default value management
- Type safety and constraints

## Docker Deployment

### Single Container

```bash
docker build -t postgresql-mcp .
docker run -p 3000:3000 -p 3001:3001 \
  -e DB_HOST=your-db-host \
  -e DB_PASSWORD=your-password \
  postgresql-mcp
```

### Docker Compose Stack

```bash
# Includes PostgreSQL, pgAdmin, Prometheus, and Grafana
docker-compose up -d

# View logs
docker-compose logs -f mcp-server

# Scale services
docker-compose up -d --scale mcp-server=3
```

## Monitoring & Observability

### Health Checks

```bash
# Basic health
curl http://localhost:3001/health

# Detailed health with metrics
curl http://localhost:3001/health/detailed

# Prometheus metrics
curl http://localhost:3001/metrics
```

### Logging

```bash
# View application logs
docker-compose logs -f mcp-server

# View database logs
docker-compose logs -f postgres
```

### Circuit Breaker Status

The circuit breaker automatically protects against database failures:

- **Closed**: Normal operation
- **Open**: Failing fast after threshold reached
- **Half-Open**: Testing recovery

Monitor status via health endpoints or logs.

## Security Considerations

- **Non-root execution** in Docker containers
- **Environment variable** configuration (no hardcoded secrets)
- **Connection pooling** prevents resource exhaustion
- **Input validation** on all MCP tool parameters
- **SQL injection prevention** via parameterized queries
- **Graceful error handling** without information leakage

## Development

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run dev  # With auto-restart
```

### Building for Production

```bash
npm run docker:build
npm run docker:run
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check database host/port configuration
   - Verify database is running and accessible
   - Check network connectivity

2. **Circuit Breaker Open**
   - Database may be temporarily unavailable
   - Check database logs for issues
   - Circuit breaker will automatically recover

3. **High Memory Usage**
   - Monitor via health endpoints
   - Adjust connection pool settings
   - Check for connection leaks

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

### Health Check Failures

```bash
# Check detailed health status
curl http://localhost:3001/health/detailed

# Check database connectivity
docker-compose exec postgres pg_isready
```

## Contributing

1. Follow the existing code structure
2. Add comprehensive error handling
3. Include health checks for new features
4. Update documentation
5. Test with Docker Compose setup

## License

This project is part of the Kilo Code ecosystem.
