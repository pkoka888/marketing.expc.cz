const z = require('zod');

// GitHub MCP Server Configuration Schema
const githubConfigSchema = z.object({
  // Server configuration
  serverName: z.string().default('github-mcp-server'),
  serverVersion: z.string().default('1.0.0'),

  // GitHub API configuration
  githubToken: z.string().min(1, 'GITHUB_TOKEN is required'),
  githubApiUrl: z.string().url().default('https://api.github.com'),
  requestTimeout: z.number().min(1000).max(60000).default(30000),

  // Tool configuration
  maxIssuesLimit: z.number().min(1).max(100).default(100),
  maxPullRequestsLimit: z.number().min(1).max(100).default(100),
  defaultIssuesLimit: z.number().min(1).max(100).default(10),
  defaultPullRequestsLimit: z.number().min(1).max(100).default(10),

  // Logging configuration
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  enableRequestLogging: z.boolean().default(true),
  enableResponseLogging: z.boolean().default(true),

  // Retry configuration
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(100).max(10000).default(1000),

  // Circuit breaker configuration
  circuitBreakerEnabled: z.boolean().default(true),
  circuitBreakerFailureThreshold: z.number().min(1).max(20).default(5),
  circuitBreakerRecoveryTimeout: z
    .number()
    .min(1000)
    .max(300000)
    .default(60000),
});

const envConfigSchema = z.object({
  // Environment variables
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_API_URL: z.string().optional(),
  SERVER_NAME: z.string().optional(),
  SERVER_VERSION: z.string().optional(),
  REQUEST_TIMEOUT: z.string().optional(),
  MAX_ISSUES_LIMIT: z.string().optional(),
  MAX_PULL_REQUESTS_LIMIT: z.string().optional(),
  DEFAULT_ISSUES_LIMIT: z.string().optional(),
  DEFAULT_PULL_REQUESTS_LIMIT: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  ENABLE_REQUEST_LOGGING: z.string().optional(),
  ENABLE_RESPONSE_LOGGING: z.string().optional(),
  MAX_RETRIES: z.string().optional(),
  RETRY_DELAY: z.string().optional(),
  CIRCUIT_BREAKER_ENABLED: z.string().optional(),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.string().optional(),
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT: z.string().optional(),
});

/**
 * Load and validate configuration from environment variables
 */
function loadConfig() {
  // Parse environment variables
  const envConfig = envConfigSchema.parse(process.env);

  // Build configuration object
  const config = {
    serverName: envConfig.SERVER_NAME || 'github-mcp-server',
    serverVersion: envConfig.SERVER_VERSION || '1.0.0',
    githubToken: envConfig.GITHUB_TOKEN || process.env.GITHUB_TOKEN,
    githubApiUrl: envConfig.GITHUB_API_URL || 'https://api.github.com',
    requestTimeout: envConfig.REQUEST_TIMEOUT
      ? parseInt(envConfig.REQUEST_TIMEOUT)
      : 30000,
    maxIssuesLimit: envConfig.MAX_ISSUES_LIMIT
      ? parseInt(envConfig.MAX_ISSUES_LIMIT)
      : 100,
    maxPullRequestsLimit: envConfig.MAX_PULL_REQUESTS_LIMIT
      ? parseInt(envConfig.MAX_PULL_REQUESTS_LIMIT)
      : 100,
    defaultIssuesLimit: envConfig.DEFAULT_ISSUES_LIMIT
      ? parseInt(envConfig.DEFAULT_ISSUES_LIMIT)
      : 10,
    defaultPullRequestsLimit: envConfig.DEFAULT_PULL_REQUESTS_LIMIT
      ? parseInt(envConfig.DEFAULT_PULL_REQUESTS_LIMIT)
      : 10,
    logLevel: envConfig.LOG_LEVEL || 'info',
    enableRequestLogging: envConfig.ENABLE_REQUEST_LOGGING
      ? envConfig.ENABLE_REQUEST_LOGGING === 'true'
      : true,
    enableResponseLogging: envConfig.ENABLE_RESPONSE_LOGGING
      ? envConfig.ENABLE_RESPONSE_LOGGING === 'true'
      : true,
    maxRetries: envConfig.MAX_RETRIES ? parseInt(envConfig.MAX_RETRIES) : 3,
    retryDelay: envConfig.RETRY_DELAY ? parseInt(envConfig.RETRY_DELAY) : 1000,
    circuitBreakerEnabled: envConfig.CIRCUIT_BREAKER_ENABLED
      ? envConfig.CIRCUIT_BREAKER_ENABLED === 'true'
      : true,
    circuitBreakerFailureThreshold: envConfig.CIRCUIT_BREAKER_FAILURE_THRESHOLD
      ? parseInt(envConfig.CIRCUIT_BREAKER_FAILURE_THRESHOLD)
      : 5,
    circuitBreakerRecoveryTimeout: envConfig.CIRCUIT_BREAKER_RECOVERY_TIMEOUT
      ? parseInt(envConfig.CIRCUIT_BREAKER_RECOVERY_TIMEOUT)
      : 60000,
  };

  // Validate final configuration
  return githubConfigSchema.parse(config);
}

/**
 * Get default configuration for development
 */
function getDefaultConfig() {
  return githubConfigSchema.parse({
    serverName: 'github-mcp-server',
    serverVersion: '1.0.0',
    githubToken: process.env.GITHUB_TOKEN || '',
    githubApiUrl: 'https://api.github.com',
    requestTimeout: 30000,
    maxIssuesLimit: 100,
    maxPullRequestsLimit: 100,
    defaultIssuesLimit: 10,
    defaultPullRequestsLimit: 10,
    logLevel: 'info',
    enableRequestLogging: true,
    enableResponseLogging: true,
    maxRetries: 3,
    retryDelay: 1000,
    circuitBreakerEnabled: true,
    circuitBreakerFailureThreshold: 5,
    circuitBreakerRecoveryTimeout: 60000,
  });
}

module.exports = {
  loadConfig,
  getDefaultConfig,
  githubConfigSchema,
};
