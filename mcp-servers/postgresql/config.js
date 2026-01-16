const Joi = require('joi');

/**
 * PostgreSQL MCP Server Configuration
 * Centralized configuration management with validation
 */

const configSchema = Joi.object({
  // Database Configuration
  database: Joi.object({
    host: Joi.string().default('localhost'),
    port: Joi.number().integer().min(1).max(65535).default(5432),
    name: Joi.string().default('marketingportal'),
    user: Joi.string().default('postgres'),
    password: Joi.string().allow('').optional(),
    ssl: Joi.boolean().default(false),
    maxConnections: Joi.number().integer().min(1).max(100).default(20),
    idleTimeoutMillis: Joi.number()
      .integer()
      .min(1000)
      .max(300000)
      .default(30000),
    connectionTimeoutMillis: Joi.number()
      .integer()
      .min(1000)
      .max(60000)
      .default(2000),
    queryTimeout: Joi.number().integer().min(1000).max(300000).default(30000),
  }).default(),

  // Server Configuration
  server: Joi.object({
    name: Joi.string().default('postgresql-mcp-server'),
    version: Joi.string().default('1.0.0'),
    port: Joi.number().integer().min(1).max(65535).default(3000),
    healthCheckPort: Joi.number().integer().min(1).max(65535).default(3001),
    enableHealthChecks: Joi.boolean().default(true),
  }).default(),

  // Logging Configuration
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    enableConsole: Joi.boolean().default(true),
    enableFile: Joi.boolean().default(false),
    logFile: Joi.string().default('./logs/postgresql-mcp.log'),
    maxFileSize: Joi.string().default('10m'),
    maxFiles: Joi.string().default('5d'),
  }).default(),

  // Circuit Breaker Configuration
  circuitBreaker: Joi.object({
    failureThreshold: Joi.number().integer().min(1).max(20).default(5),
    recoveryTimeout: Joi.number()
      .integer()
      .min(10000)
      .max(300000)
      .default(60000),
    monitoringPeriod: Joi.number()
      .integer()
      .min(1000)
      .max(60000)
      .default(10000),
  }).default(),

  // Retry Configuration
  retry: Joi.object({
    maxAttempts: Joi.number().integer().min(1).max(10).default(3),
    baseDelay: Joi.number().integer().min(100).max(10000).default(1000),
    maxDelay: Joi.number().integer().min(1000).max(60000).default(10000),
    backoffMultiplier: Joi.number().min(1).max(3).default(2),
    retryableErrors: Joi.array().items(Joi.string()).default([
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE',
      '42P01', // PostgreSQL: relation does not exist
      '23505', // PostgreSQL: unique violation
      '23503', // PostgreSQL: foreign key violation
    ]),
  }).default(),

  // Health Check Configuration
  healthChecks: Joi.object({
    enabled: Joi.boolean().default(true),
    interval: Joi.number().integer().min(5000).max(300000).default(30000),
    timeout: Joi.number().integer().min(1000).max(30000).default(5000),
    databasePingEnabled: Joi.boolean().default(true),
    memoryThreshold: Joi.number().min(0.1).max(1).default(0.9),
    cpuThreshold: Joi.number().min(0.1).max(1).default(0.8),
  }).default(),

  // Docker Configuration
  docker: Joi.object({
    user: Joi.string().default('node'),
    port: Joi.number().integer().min(1).max(65535).default(3000),
    healthCheckPort: Joi.number().integer().min(1).max(65535).default(3001),
    nodeEnv: Joi.string()
      .valid('development', 'production')
      .default('production'),
  }).default(),
});

/**
 * Load configuration from environment variables and validate
 */
function loadConfig() {
  const config = {
    database: {
      host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
      port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432'),
      name: process.env.DB_NAME || process.env.PGDATABASE || 'marketingportal',
      user: process.env.DB_USER || process.env.PGUSER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
      ssl: process.env.DB_SSL === 'true' || process.env.PGSSLMODE === 'require',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(
        process.env.DB_CONNECTION_TIMEOUT || '2000'
      ),
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
    },
    server: {
      name: process.env.MCP_SERVER_NAME || 'postgresql-mcp-server',
      version: process.env.MCP_SERVER_VERSION || '1.0.0',
      port: parseInt(process.env.MCP_SERVER_PORT || '3000'),
      healthCheckPort: parseInt(process.env.MCP_HEALTH_CHECK_PORT || '3001'),
      enableHealthChecks: process.env.MCP_ENABLE_HEALTH_CHECKS !== 'false',
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      enableConsole: process.env.LOG_CONSOLE !== 'false',
      enableFile: process.env.LOG_FILE === 'true',
      logFile: process.env.LOG_FILE_PATH || './logs/postgresql-mcp.log',
      maxFileSize: process.env.LOG_MAX_FILE_SIZE || '10m',
      maxFiles: process.env.LOG_MAX_FILES || '5d',
    },
    circuitBreaker: {
      failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD || '5'),
      recoveryTimeout: parseInt(process.env.CB_RECOVERY_TIMEOUT || '60000'),
      monitoringPeriod: parseInt(process.env.CB_MONITORING_PERIOD || '10000'),
    },
    retry: {
      maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3'),
      baseDelay: parseInt(process.env.RETRY_BASE_DELAY || '1000'),
      maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '10000'),
      backoffMultiplier: parseFloat(
        process.env.RETRY_BACKOFF_MULTIPLIER || '2'
      ),
      retryableErrors: (
        process.env.RETRYABLE_ERRORS ||
        'ECONNREFUSED,ENOTFOUND,ETIMEDOUT,ECONNRESET,EPIPE,42P01,23505,23503'
      ).split(','),
    },
    healthChecks: {
      enabled: process.env.HEALTH_CHECKS_ENABLED !== 'false',
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
      databasePingEnabled: process.env.DB_PING_ENABLED !== 'false',
      memoryThreshold: parseFloat(process.env.MEMORY_THRESHOLD || '0.9'),
      cpuThreshold: parseFloat(process.env.CPU_THRESHOLD || '0.8'),
    },
    docker: {
      user: process.env.DOCKER_USER || 'node',
      port: parseInt(process.env.DOCKER_PORT || '3000'),
      healthCheckPort: parseInt(process.env.DOCKER_HEALTH_CHECK_PORT || '3001'),
      nodeEnv: process.env.NODE_ENV || 'production',
    },
  };

  const { error, value } = configSchema.validate(config, {
    allowUnknown: true,
  });

  if (error) {
    throw new Error(
      `Configuration validation error: ${error.details.map((d) => d.message).join(', ')}`
    );
  }

  return value;
}

// Load and export configuration
const config = loadConfig();

module.exports = config;
