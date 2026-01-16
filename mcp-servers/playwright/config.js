/**
 * Configuration for Playwright MCP Server
 */

const path = require('path');

const config = {
  // Server configuration
  server: {
    name: 'playwright-mcp-server',
    version: '2.0.0',
    port: process.env.PORT || 3001,
    host: process.env.HOST || '0.0.0.0',
  },

  // Playwright configuration
  playwright: {
    defaultBrowser: process.env.DEFAULT_BROWSER || 'chromium',
    defaultHeadless: process.env.DEFAULT_HEADLESS !== 'false',
    defaultParallel: process.env.DEFAULT_PARALLEL === 'true',
    defaultReporter: process.env.DEFAULT_REPORTER || 'list',
    testTimeout: parseInt(process.env.TEST_TIMEOUT) || 30000, // 30 seconds
    globalTimeout: parseInt(process.env.GLOBAL_TIMEOUT) || 300000, // 5 minutes
    workers: parseInt(process.env.WORKERS) || 1,
  },

  // Circuit breaker configuration
  circuitBreaker: {
    failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD) || 5,
    recoveryTimeout: parseInt(process.env.CB_RECOVERY_TIMEOUT) || 60000, // 1 minute
    monitoringTimeout: parseInt(process.env.CB_MONITORING_TIMEOUT) || 30000, // 30 seconds
  },

  // Retry configuration
  retry: {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS) || 3,
    baseDelay: parseInt(process.env.RETRY_BASE_DELAY) || 1000, // 1 second
    maxDelay: parseInt(process.env.RETRY_MAX_DELAY) || 10000, // 10 seconds
    backoffMultiplier: parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER) || 2.0,
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFile: process.env.LOG_FILE === 'true',
    logFile:
      process.env.LOG_FILE_PATH ||
      path.join(__dirname, 'logs', 'playwright.log'),
    maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE) || 10485760, // 10MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
  },

  // Health check configuration
  health: {
    enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
    port: parseInt(process.env.HEALTH_CHECK_PORT) || 8081,
    path: process.env.HEALTH_CHECK_PATH || '/health',
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
  },

  // Test execution limits
  limits: {
    maxTestFiles: parseInt(process.env.MAX_TEST_FILES) || 100,
    maxTestDuration: parseInt(process.env.MAX_TEST_DURATION) || 1800000, // 30 minutes
    maxConcurrentTests: parseInt(process.env.MAX_CONCURRENT_TESTS) || 5,
  },

  // Docker configuration
  docker: {
    enabled: process.env.DOCKER_ENABLED === 'true',
    containerName: process.env.CONTAINER_NAME || 'playwright-mcp-server',
    restartPolicy: process.env.RESTART_POLICY || 'unless-stopped',
  },

  // Environment detection
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment:
    process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
};

// Validation
if (config.playwright.testTimeout < 1000) {
  throw new Error('TEST_TIMEOUT must be at least 1000ms');
}

if (config.circuitBreaker.failureThreshold < 1) {
  throw new Error('CB_FAILURE_THRESHOLD must be greater than 0');
}

if (config.retry.maxAttempts < 1 || config.retry.maxAttempts > 10) {
  throw new Error('RETRY_MAX_ATTEMPTS must be between 1 and 10');
}

if (config.limits.maxTestFiles < 1 || config.limits.maxTestFiles > 1000) {
  throw new Error('MAX_TEST_FILES must be between 1 and 1000');
}

module.exports = config;
