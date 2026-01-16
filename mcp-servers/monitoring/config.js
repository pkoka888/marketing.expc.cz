/**
 * Configuration for Monitoring MCP Server
 */

const path = require('path');

const config = {
  // Server configuration
  server: {
    name: 'monitoring-mcp-server',
    version: '2.0.0',
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
  },

  // Monitoring configuration
  monitoring: {
    defaultInterval: parseInt(process.env.MONITORING_INTERVAL) || 30, // seconds
    maxDuration: parseInt(process.env.MAX_MONITORING_DURATION) || 3600, // 1 hour
    metricsRetention: parseInt(process.env.METRICS_RETENTION) || 1000, // number of metric snapshots
    alertsRetention: parseInt(process.env.ALERTS_RETENTION) || 100, // number of alerts to keep
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
      path.join(__dirname, 'logs', 'monitoring.log'),
    maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE) || 10485760, // 10MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
  },

  // Health check configuration
  health: {
    enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
    port: parseInt(process.env.HEALTH_CHECK_PORT) || 8080,
    path: process.env.HEALTH_CHECK_PATH || '/health',
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
  },

  // Alert thresholds
  thresholds: {
    cpuUsage: parseFloat(process.env.CPU_THRESHOLD) || 0.8,
    memoryUsage: parseFloat(process.env.MEMORY_THRESHOLD) || 0.9,
    diskUsage: parseFloat(process.env.DISK_THRESHOLD) || 0.9,
  },

  // Docker configuration
  docker: {
    enabled: process.env.DOCKER_ENABLED === 'true',
    containerName: process.env.CONTAINER_NAME || 'monitoring-mcp-server',
    restartPolicy: process.env.RESTART_POLICY || 'unless-stopped',
  },

  // Environment detection
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment:
    process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
};

// Validation
if (
  config.monitoring.defaultInterval < 1 ||
  config.monitoring.defaultInterval > 3600
) {
  throw new Error('MONITORING_INTERVAL must be between 1 and 3600 seconds');
}

if (config.circuitBreaker.failureThreshold < 1) {
  throw new Error('CB_FAILURE_THRESHOLD must be greater than 0');
}

if (config.retry.maxAttempts < 1 || config.retry.maxAttempts > 10) {
  throw new Error('RETRY_MAX_ATTEMPTS must be between 1 and 10');
}

module.exports = config;
