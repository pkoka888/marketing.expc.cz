# GitHub MCP Server

A Model Context Protocol (MCP) server that provides GitHub API integration with comprehensive error handling, logging, and Docker optimization.

## Features

- **GitHub API Integration**: Access GitHub issues and pull requests
- **Structured Logging**: Comprehensive logging with correlation IDs
- **Error Handling**: Retry logic and circuit breaker patterns
- **Configuration Management**: Environment-based configuration with validation
- **Health Monitoring**: Built-in health check endpoint
- **Docker Optimized**: Multi-stage builds with security best practices

## Tools

### `get_issues`

Get issues from a GitHub repository.

**Parameters:**

- `owner` (string): Repository owner
- `repo` (string): Repository name
- `state` (enum): Issue state - "open", "closed", or "all" (default: "open")
- `limit` (number): Maximum number of issues to return (1-100, default: 10)

### `get_pull_requests`

Get pull requests from a GitHub repository.

**Parameters:**

- `owner` (string): Repository owner
- `repo` (string): Repository name
- `state` (enum): Pull request state - "open", "closed", or "all" (default: "open")
- `limit` (number): Maximum number of pull requests to return (1-100, default: 10)

### `health_check`

Check the health status of the GitHub MCP server.

**Parameters:**

- `includeCircuitBreaker` (boolean): Include circuit breaker status (default: true)
- `includeConfig` (boolean): Include configuration status (default: false)

## Configuration

The server supports extensive configuration via environment variables:

### Required

- `GITHUB_TOKEN`: GitHub personal access token

### Optional

- `SERVER_NAME`: Server name (default: "github-mcp-server")
- `SERVER_VERSION`: Server version (default: "1.0.0")
- `GITHUB_API_URL`: GitHub API base URL (default: "https://api.github.com")
- `REQUEST_TIMEOUT`: Request timeout in ms (default: 30000)
- `MAX_ISSUES_LIMIT`: Maximum issues limit (default: 100)
- `MAX_PULL_REQUESTS_LIMIT`: Maximum pull requests limit (default: 100)
- `DEFAULT_ISSUES_LIMIT`: Default issues limit (default: 10)
- `DEFAULT_PULL_REQUESTS_LIMIT`: Default pull requests limit (default: 10)
- `LOG_LEVEL`: Logging level (default: "info")
- `MAX_RETRIES`: Maximum retry attempts (default: 3)
- `RETRY_DELAY`: Delay between retries in ms (default: 1000)
- `CIRCUIT_BREAKER_ENABLED`: Enable circuit breaker (default: true)
- `CIRCUIT_BREAKER_FAILURE_THRESHOLD`: Circuit breaker threshold (default: 5)
- `CIRCUIT_BREAKER_RECOVERY_TIMEOUT`: Recovery timeout in ms (default: 60000)

## Installation

### Local Development

1. Install dependencies:

```bash
npm install
```

2. Set environment variables:

```bash
export GITHUB_TOKEN=your_github_token_here
```

3. Run the server:

```bash
npm start
```

### Docker

1. Build the image:

```bash
docker build -t github-mcp-server .
```

2. Run with docker-compose:

```bash
docker-compose up -d
```

Or run directly:

```bash
docker run -e GITHUB_TOKEN=your_token github-mcp-server
```

## Architecture

### Error Handling

- **Retry Logic**: Exponential backoff retry for transient failures
- **Circuit Breaker**: Prevents cascading failures when GitHub API is down
- **Timeout Management**: Configurable timeouts for all API calls

### Logging

- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Request/Response Tracking**: Complete API call lifecycle logging
- **Error Context**: Detailed error information with stack traces

### Security

- **Token Management**: Secure GitHub token handling
- **Input Validation**: Zod schema validation for all inputs
- **Non-root Container**: Runs as non-privileged user in Docker

## Health Monitoring

The server includes a `health_check` tool that provides:

- Overall server status (healthy/degraded/unhealthy)
- Uptime information
- Circuit breaker status
- Configuration validation
- GitHub API connectivity test

## Development

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Health Check

```bash
npm run health
```

## Docker Optimization

The Dockerfile implements several optimization techniques:

- **Multi-stage builds**: Separate build and production stages
- **Minimal base image**: Uses Alpine Linux for smaller size
- **Non-root user**: Runs with reduced privileges
- **Dependency optimization**: Only production dependencies in final image
- **Security hardening**: No unnecessary packages or privileges

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure Docker builds pass

## License

This project is part of the MarketingPortal codebase.
