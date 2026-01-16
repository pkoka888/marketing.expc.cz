# Playwright MCP Server

An optimized Model Context Protocol (MCP) server for Playwright test automation and management with advanced error handling, logging, and Docker support.

## Features

- **MCP Server Architecture**: Migrated to McpServer class for better performance and compatibility
- **Comprehensive Error Handling**: Circuit breaker, retry logic, and timeout management
- **Advanced Logging**: Structured logging with configurable levels and file output
- **Health Checks**: Built-in health monitoring with detailed system status
- **Docker Optimization**: Multi-stage Docker builds with security hardening
- **Configuration Management**: Environment-based configuration with validation

## Architecture

### Core Components

- **McpServer**: Main MCP server instance using the latest SDK
- **SimpleLogger**: Structured logging with console and file output
- **SimpleErrorHandler**: Comprehensive error handling with circuit breaker and retry
- **Health Checks**: Express-based health monitoring endpoints
- **Configuration**: Environment-driven configuration with validation

### Error Handling Strategy

1. **Circuit Breaker**: Prevents cascading failures with configurable thresholds
2. **Retry Logic**: Exponential backoff retry with configurable attempts
3. **Timeout Management**: Prevents hanging operations
4. **Graceful Degradation**: Continues operation even with partial failures

### Tools

- `run_tests`: Execute Playwright tests with various options
- `generate_test`: Create new test files from templates
- `get_test_results`: Retrieve test results and reports
- `debug_test`: Debug specific tests with trace viewer

## Configuration

### Environment Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Playwright Configuration
DEFAULT_BROWSER=chromium
DEFAULT_HEADLESS=true
DEFAULT_PARALLEL=true
DEFAULT_REPORTER=list
TEST_TIMEOUT=30000
GLOBAL_TIMEOUT=300000
WORKERS=1

# Circuit Breaker
CB_FAILURE_THRESHOLD=5
CB_RECOVERY_TIMEOUT=60000

# Retry Configuration
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY=1000
RETRY_MAX_DELAY=10000

# Logging
LOG_LEVEL=info
LOG_CONSOLE=true
LOG_FILE=true
LOG_FILE_PATH=./logs/playwright.log

# Health Checks
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PORT=8081
HEALTH_CHECK_PATH=/health
HEALTH_CHECK_INTERVAL=30000

# Limits
MAX_TEST_FILES=100
MAX_TEST_DURATION=1800000
MAX_CONCURRENT_TESTS=5
```

## Installation

### Local Development

```bash
cd mcp-servers/playwright
npm install
npm start
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build manually
docker build -t playwright-mcp-server .
docker run -p 8081:8081 playwright-mcp-server
```

## Health Checks

### Basic Health Check

```bash
curl http://localhost:8081/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-16T03:20:25.375Z",
  "checks": {
    "playwright": { "status": "healthy", "version": "installed" },
    "circuitBreaker": { "status": "healthy", "state": "closed", "failures": 0 },
    "testDirectory": { "status": "healthy", "path": "...", "exists": true }
  },
  "uptime": 98.2145826,
  "version": "2.0.0"
}
```

### Detailed Health Check

```bash
curl http://localhost:8081/health/detailed
```

Includes system information, configuration summary, and error handler statistics.

## Docker Optimization

### Security Features

- Non-root user execution
- Minimal Alpine Linux base image
- No new privileges capability
- Read-only root filesystem (except logs)
- Dropped unnecessary capabilities

### Performance Optimizations

- Multi-stage build to reduce image size
- Chromium pre-installed for Playwright
- Optimized layer caching
- Health check integration

## Logging

### Log Levels

- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages
- `debug`: Debug information

### Log Output

Logs are written to both console and file (configurable). Each log entry includes:

- Timestamp
- Level
- Message
- Metadata (correlation ID, request details, etc.)

## Error Handling

### Circuit Breaker States

- **Closed**: Normal operation
- **Open**: Failing fast, rejecting requests
- **Half-Open**: Testing recovery

### Retry Strategy

- Exponential backoff with jitter
- Configurable max attempts
- Context-aware retry decisions

## Development

### Testing

```bash
# Install Playwright browsers
npx playwright install

# Run tests
npm test
```

### Debugging

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Check health status
curl http://localhost:8081/health/detailed
```

## Monitoring

The server provides comprehensive monitoring through:

- Health check endpoints
- Structured logging
- Circuit breaker statistics
- Performance metrics
- Error tracking

## Security Considerations

- Environment variable validation
- Input sanitization
- Timeout enforcement
- Resource limits
- Non-root execution in Docker

## Troubleshooting

### Common Issues

1. **Health Check Fails**: Check if Playwright is properly installed
2. **Circuit Breaker Open**: Review recent error logs and system resources
3. **Test Directory Missing**: Ensure tests directory exists or create it
4. **Port Conflicts**: Verify health check port is available

### Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=debug LOG_CONSOLE=true npm start
```

## Contributing

1. Follow the existing code structure
2. Add appropriate error handling
3. Include health check updates for new features
4. Update configuration validation
5. Add comprehensive logging

## License

MIT License
