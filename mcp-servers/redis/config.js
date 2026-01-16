const { z } = require('zod');

// Redis connection configuration schema
const redisConfigSchema = z.object({
  host: z.string().default(process.env.REDIS_HOST || 'localhost'),
  port: z
    .number()
    .min(1)
    .max(65535)
    .default(parseInt(process.env.REDIS_PORT) || 6379),
  password: z.string().optional().default(process.env.REDIS_PASSWORD),
  db: z
    .number()
    .min(0)
    .max(15)
    .default(parseInt(process.env.REDIS_DB) || 0),
  username: z.string().optional().default(process.env.REDIS_USERNAME),
  tls: z.boolean().default(process.env.REDIS_TLS === 'true'),
  cluster: z.boolean().default(process.env.REDIS_CLUSTER === 'true'),
});

// Server configuration schema
const serverConfigSchema = z.object({
  name: z.string().default('redis-mcp-server'),
  version: z.string().default('1.0.0'),
  logLevel: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default(process.env.LOG_LEVEL || 'info'),
  enableHealthChecks: z
    .boolean()
    .default(process.env.ENABLE_HEALTH_CHECKS !== 'false'),
  healthCheckPort: z
    .number()
    .min(1)
    .max(65535)
    .default(parseInt(process.env.HEALTH_CHECK_PORT) || 3000),
});

// Circuit breaker configuration
const circuitBreakerConfigSchema = z.object({
  failureThreshold: z
    .number()
    .min(1)
    .max(20)
    .default(parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD) || 5),
  recoveryTimeout: z
    .number()
    .min(1000)
    .max(300000)
    .default(parseInt(process.env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT) || 60000),
  monitoringPeriod: z
    .number()
    .min(1000)
    .max(60000)
    .default(parseInt(process.env.CIRCUIT_BREAKER_MONITORING_PERIOD) || 10000),
});

// Retry configuration
const retryConfigSchema = z.object({
  maxRetries: z
    .number()
    .min(0)
    .max(10)
    .default(parseInt(process.env.RETRY_MAX_RETRIES) || 3),
  baseDelay: z
    .number()
    .min(100)
    .max(10000)
    .default(parseInt(process.env.RETRY_BASE_DELAY) || 1000),
  maxDelay: z
    .number()
    .min(1000)
    .max(60000)
    .default(parseInt(process.env.RETRY_MAX_DELAY) || 10000),
  backoffMultiplier: z
    .number()
    .min(1)
    .max(5)
    .default(parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER) || 2),
});

// Timeout configuration
const timeoutConfigSchema = z.object({
  connectionTimeout: z
    .number()
    .min(1000)
    .max(30000)
    .default(parseInt(process.env.CONNECTION_TIMEOUT) || 5000),
  operationTimeout: z
    .number()
    .min(1000)
    .max(60000)
    .default(parseInt(process.env.OPERATION_TIMEOUT) || 10000),
  healthCheckTimeout: z
    .number()
    .min(100)
    .max(5000)
    .default(parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 1000),
});

// Main configuration schema
const configSchema = z.object({
  redis: redisConfigSchema,
  server: serverConfigSchema,
  circuitBreaker: circuitBreakerConfigSchema,
  retry: retryConfigSchema,
  timeout: timeoutConfigSchema,
});

let config = null;

/**
 * Load and validate configuration from environment variables
 */
function loadConfig() {
  if (config) {
    return config;
  }

  try {
    config = configSchema.parse({
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : undefined,
        username: process.env.REDIS_USERNAME,
        tls: process.env.REDIS_TLS === 'true',
        cluster: process.env.REDIS_CLUSTER === 'true',
      },
      server: {
        name: process.env.SERVER_NAME,
        version: process.env.SERVER_VERSION,
        logLevel: process.env.LOG_LEVEL,
        enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
        healthCheckPort: process.env.HEALTH_CHECK_PORT ? parseInt(process.env.HEALTH_CHECK_PORT) : undefined,
      },
      circuitBreaker: {
        failureThreshold: process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD ? parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD) : undefined,
        recoveryTimeout: process.env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT ? parseInt(process.env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT) : undefined,
        monitoringPeriod: process.env.CIRCUIT_BREAKER_MONITORING_PERIOD ? parseInt(process.env.CIRCUIT_BREAKER_MONITORING_PERIOD) : undefined,
      },
      retry: {
        maxRetries: process.env.RETRY_MAX_RETRIES,
        baseDelay: process.env.RETRY_BASE_DELAY,
        maxDelay: process.env.RETRY_MAX_DELAY,
        backoffMultiplier: process.env.RETRY_BACKOFF_MULTIPLIER,
      },
      timeout: {
        connectionTimeout: process.env.CONNECTION_TIMEOUT,
        operationTimeout: process.env.OPERATION_TIMEOUT,
        healthCheckTimeout: process.env.HEALTH_CHECK_TIMEOUT,
      },
    });

    return config;
  } catch (error) {
    console.error('Configuration validation failed:', error.errors);
    throw new Error(`Invalid configuration: ${error.message}`);
  }
}

/**
 * Get current configuration
 */
function getConfig() {
  if (!config) {
    return loadConfig();
  }
  return config;
}

/**
 * Update configuration (for testing or dynamic reconfiguration)
 */
function updateConfig(newConfig) {
  try {
    config = configSchema.parse(newConfig);
    return config;
  } catch (error) {
    throw new Error(`Invalid configuration update: ${error.message}`);
  }
}

module.exports = {
  loadConfig,
  getConfig,
  updateConfig,
  configSchema,
};
