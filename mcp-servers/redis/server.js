#!/usr/bin/env node

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const {
  StdioServerTransport,
} = require('@modelcontextprotocol/sdk/server/stdio.js');
const Redis = require('ioredis');
require('dotenv').config();
const z = require('zod');

// Import configuration and utilities
const { getConfig } = require('./config');
const { kiloCodeLogger } = require('@kilo-code/error-handling/logger');
const {
  ExponentialBackoffRetry,
  retryConfigs,
} = require('@kilo-code/error-handling');
const {
  CircuitBreaker,
  circuitBreakerRegistry,
} = require('@kilo-code/error-handling');
const { TimeoutHandler } = require('@kilo-code/error-handling');

// Custom error classes
class RedisConnectionError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'RedisConnectionError';
    this.originalError = originalError;
  }
}

class RedisOperationError extends Error {
  constructor(message, operation, originalError = null) {
    super(message);
    this.name = 'RedisOperationError';
    this.operation = operation;
    this.originalError = originalError;
  }
}

class RedisMCPServer {
  constructor() {
    // Load configuration
    this.config = getConfig();

    // Initialize logger
    this.logger = kiloCodeLogger.createLogger('redis-mcp-server');

    // Initialize circuit breaker for Redis operations
    this.circuitBreaker = circuitBreakerRegistry.createBreaker(
      'redis-operations',
      {
        failureThreshold: this.config.circuitBreaker.failureThreshold,
        recoveryTimeout: this.config.circuitBreaker.recoveryTimeout,
        monitoringPeriod: this.config.circuitBreaker.monitoringPeriod,
      }
    );

    // Initialize retry handler
    this.retryHandler = new ExponentialBackoffRetry({
      maxRetries: this.config.retry.maxRetries,
      baseDelay: this.config.retry.baseDelay,
      maxDelay: this.config.retry.maxDelay,
      backoffMultiplier: this.config.retry.backoffMultiplier,
    });

    // Initialize timeout handler
    this.timeoutHandler = new TimeoutHandler({
      defaultTimeout: this.config.timeout.operationTimeout,
    });

    // Initialize MCP server
    this.server = new McpServer({
      name: this.config.server.name,
      version: this.config.server.version,
    });

    this.redis = null;
    this.isConnected = false;

    this.logger.info('Redis MCP Server initialized', {
      config: {
        redis: {
          host: this.config.redis.host,
          port: this.config.redis.port,
          db: this.config.redis.db,
          tls: this.config.redis.tls,
        },
        circuitBreaker: this.config.circuitBreaker,
        retry: this.config.retry,
      },
    });

    this.setupToolHandlers();
  }

  /**
   * Generate a correlation ID for request tracing
   */
  generateCorrelationId() {
    return `redis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set up Redis event handlers for monitoring connection state
   */
  setupRedisEventHandlers() {
    if (!this.redis) return;

    this.redis.on('connect', () => {
      this.logger.info('Redis connection established');
      this.isConnected = true;
    });

    this.redis.on('ready', () => {
      this.logger.info('Redis connection ready');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', { error: error.message });
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.redis.on('reconnecting', (delay) => {
      this.logger.warn('Redis reconnecting', { delay });
    });
  }

  /**
   * Execute a Redis operation with circuit breaker, retry, and timeout protection
   */
  async executeRedisOperation(operation, correlationId, operationName) {
    if (!this.redis || !this.isConnected) {
      throw new RedisConnectionError(
        'Not connected to Redis. Use connect tool first.'
      );
    }

    return await this.circuitBreaker.execute(
      async () => {
        return await this.timeoutHandler.execute(
          async () => {
            return await this.retryHandler.execute(
              operation,
              { correlationId, operation: operationName },
              `redis-${operationName}`
            );
          },
          this.config.timeout.operationTimeout,
          { correlationId, operation: operationName },
          { complexity: 'low' }
        );
      },
      { correlationId, operation: operationName }
    );
  }

  setupToolHandlers() {
    // Register connect tool
    this.server.registerTool(
      'connect',
      {
        title: 'Connect to Redis',
        description: 'Connect to Redis instance',
        inputSchema: {
          host: z
            .string()
            .default(process.env.REDIS_HOST || 'localhost')
            .describe('Redis host'),
          port: z
            .number()
            .min(1)
            .max(65535)
            .default(process.env.REDIS_PORT || 6379)
            .describe('Redis port'),
          password: z.string().optional().describe('Redis password'),
          db: z.number().min(0).default(0).describe('Redis database number'),
        },
        outputSchema: {
          message: z.string(),
        },
      },
      async (args) => await this.connect(args)
    );

    // Register get tool
    this.server.registerTool(
      'get',
      {
        title: 'Get Key',
        description: 'Get value from Redis by key',
        inputSchema: {
          key: z.string().describe('Redis key'),
        },
        outputSchema: {
          key: z.string(),
          value: z.string().nullable(),
          ttl: z.string(),
          exists: z.boolean(),
        },
      },
      async (args) => await this.get(args)
    );

    // Register set tool
    this.server.registerTool(
      'set',
      {
        title: 'Set Key',
        description: 'Set value in Redis with optional TTL',
        inputSchema: {
          key: z.string().describe('Redis key'),
          value: z.string().describe('Value to set'),
          ttl: z.number().min(1).optional().describe('TTL in seconds'),
        },
        outputSchema: {
          message: z.string(),
        },
      },
      async (args) => await this.set(args)
    );

    // Register delete tool
    this.server.registerTool(
      'delete',
      {
        title: 'Delete Key',
        description: 'Delete key from Redis',
        inputSchema: {
          key: z.string().describe('Redis key to delete'),
        },
        outputSchema: {
          message: z.string(),
        },
      },
      async (args) => await this.delete(args)
    );

    // Register keys tool
    this.server.registerTool(
      'keys',
      {
        title: 'Get Keys',
        description: 'Get keys matching pattern',
        inputSchema: {
          pattern: z.string().default('*').describe('Key pattern'),
        },
        outputSchema: {
          pattern: z.string(),
          keys: z.array(z.string()),
          total: z.number(),
        },
      },
      async (args) => await this.keys(args)
    );

    // Register info tool
    this.server.registerTool(
      'info',
      {
        title: 'Get Info',
        description: 'Get Redis server information',
        inputSchema: {
          section: z
            .enum([
              'server',
              'clients',
              'memory',
              'persistence',
              'stats',
              'replication',
              'cpu',
              'commandstats',
              'cluster',
              'keyspace',
            ])
            .optional()
            .describe('Info section'),
        },
        outputSchema: {
          info: z.string(),
        },
      },
      async (args) => await this.info(args)
    );

    // Register monitor_cache tool
    this.server.registerTool(
      'monitor_cache',
      {
        title: 'Monitor Cache',
        description: 'Monitor cache performance and statistics',
        inputSchema: {
          duration: z
            .number()
            .min(10)
            .max(3600)
            .default(60)
            .describe('Monitoring duration in seconds'),
        },
        outputSchema: {
          hits: z.number(),
          misses: z.number(),
          commands: z.number(),
          memoryUsage: z.array(
            z.object({
              timestamp: z.string(),
              usedMemory: z.number(),
            })
          ),
          startTime: z.string(),
          endTime: z.string(),
          duration: z.number(),
          hitRate: z.number(),
        },
      },
      async (args) => await this.monitorCache(args)
    );

    // Register flush_db tool
    this.server.registerTool(
      'flush_db',
      {
        title: 'Flush Database',
        description: 'Flush current database',
        inputSchema: {
          confirm: z.boolean().describe('Confirmation flag - must be true'),
        },
        outputSchema: {
          message: z.string(),
        },
      },
      async (args) => await this.flushDb(args)
    );
  }

  async connect({ host, port, password, db }) {
    const correlationId = this.generateCorrelationId();
    const startTime = Date.now();

    this.logger.info('Attempting to connect to Redis', {
      correlationId,
      host: host || this.config.redis.host,
      port: port || this.config.redis.port,
      db: db || this.config.redis.db,
    });

    try {
      // Disconnect existing connection if any
      if (this.redis) {
        await this.redis.disconnect();
        this.isConnected = false;
      }

      // Use circuit breaker for connection attempt
      const connectionResult = await this.circuitBreaker.execute(
        async () => {
          return await this.timeoutHandler.execute(
            async () => {
              return await this.retryHandler.execute(
                async () => {
                  const redisConfig = {
                    host: host || this.config.redis.host,
                    port: port || this.config.redis.port,
                    password: password || this.config.redis.password,
                    db: db || this.config.redis.db,
                    username: this.config.redis.username,
                    tls: this.config.redis.tls ? {} : undefined,
                    retryDelayOnFailover: 100,
                    maxRetriesPerRequest: 1, // Let our retry handler manage retries
                    lazyConnect: false,
                    connectTimeout: this.config.timeout.connectionTimeout,
                    commandTimeout: this.config.timeout.operationTimeout,
                  };

                  this.redis = new Redis(redisConfig);

                  // Set up event handlers
                  this.setupRedisEventHandlers();

                  // Wait for connection
                  await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                      reject(new RedisConnectionError('Connection timeout'));
                    }, this.config.timeout.connectionTimeout);

                    this.redis.once('connect', () => {
                      clearTimeout(timeout);
                      resolve();
                    });

                    this.redis.once('error', (error) => {
                      clearTimeout(timeout);
                      reject(
                        new RedisConnectionError('Connection failed', error)
                      );
                    });
                  });

                  // Test connection with ping
                  await this.redis.ping();
                  return redisConfig;
                },
                {
                  correlationId,
                  operation: 'connect',
                  host: host || this.config.redis.host,
                  port: port || this.config.redis.port,
                },
                'redis-connect'
              );
            },
            this.config.timeout.connectionTimeout,
            {
              correlationId,
              operation: 'connect',
              host: host || this.config.redis.host,
              port: port || this.config.redis.port,
            },
            { complexity: 'low' }
          );
        },
        {
          correlationId,
          operation: 'connect',
          host: host || this.config.redis.host,
          port: port || this.config.redis.port,
        }
      );

      this.isConnected = true;
      const duration = Date.now() - startTime;

      this.logger.info('Successfully connected to Redis', {
        correlationId,
        host: connectionResult.host,
        port: connectionResult.port,
        db: connectionResult.db,
        duration,
      });

      const message = `Connected to Redis at ${connectionResult.host}:${connectionResult.port}, database ${connectionResult.db}`;
      return {
        content: [{ type: 'text', text: message }],
        structuredContent: { message, duration },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.isConnected = false;

      this.logger.error('Failed to connect to Redis', {
        correlationId,
        error: error.message,
        stack: error.stack,
        duration,
        host: host || this.config.redis.host,
        port: port || this.config.redis.port,
      });

      if (error instanceof RedisConnectionError) {
        throw error;
      }

      throw new RedisConnectionError(
        `Failed to connect to Redis: ${error.message}`,
        error
      );
    }
  }

  async get({ key }) {
    const correlationId = this.generateCorrelationId();
    const startTime = Date.now();

    this.logger.info('Executing GET operation', { correlationId, key });

    try {
      const result = await this.executeRedisOperation(
        async () => {
          const value = await this.redis.get(key);
          const ttl = await this.redis.ttl(key);
          return { value, ttl };
        },
        correlationId,
        'get'
      );

      const output = {
        key,
        value: result.value,
        ttl: result.ttl === -1 ? 'no expiration' : `${result.ttl} seconds`,
        exists: result.value !== null,
      };

      const duration = Date.now() - startTime;
      this.logger.info('GET operation completed successfully', {
        correlationId,
        key,
        exists: output.exists,
        duration,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('GET operation failed', {
        correlationId,
        key,
        error: error.message,
        stack: error.stack,
        duration,
      });

      if (
        error instanceof RedisConnectionError ||
        error instanceof RedisOperationError
      ) {
        throw error;
      }

      throw new RedisOperationError(
        `Error getting key '${key}': ${error.message}`,
        'get',
        error
      );
    }
  }

  async set({ key, value, ttl }) {
    const correlationId = this.generateCorrelationId();
    const startTime = Date.now();

    this.logger.info('Executing SET operation', { correlationId, key, ttl });

    try {
      await this.executeRedisOperation(
        async () => {
          if (ttl) {
            await this.redis.setex(key, ttl, value);
          } else {
            await this.redis.set(key, value);
          }
        },
        correlationId,
        'set'
      );

      const duration = Date.now() - startTime;
      const message = `Key '${key}' set successfully${ttl ? ` with TTL of ${ttl} seconds` : ''}`;

      this.logger.info('SET operation completed successfully', {
        correlationId,
        key,
        ttl,
        duration,
      });

      return {
        content: [{ type: 'text', text: message }],
        structuredContent: { message },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('SET operation failed', {
        correlationId,
        key,
        ttl,
        error: error.message,
        stack: error.stack,
        duration,
      });

      if (
        error instanceof RedisConnectionError ||
        error instanceof RedisOperationError
      ) {
        throw error;
      }

      throw new RedisOperationError(
        `Error setting key '${key}': ${error.message}`,
        'set',
        error
      );
    }
  }

  async delete({ key }) {
    const correlationId = this.generateCorrelationId();
    const startTime = Date.now();

    this.logger.info('Executing DELETE operation', { correlationId, key });

    try {
      const result = await this.executeRedisOperation(
        async () => {
          return await this.redis.del(key);
        },
        correlationId,
        'delete'
      );

      const duration = Date.now() - startTime;
      const message =
        result > 0
          ? `Key '${key}' deleted successfully`
          : `Key '${key}' not found`;

      this.logger.info('DELETE operation completed', {
        correlationId,
        key,
        deleted: result > 0,
        duration,
      });

      return {
        content: [{ type: 'text', text: message }],
        structuredContent: { message, deleted: result > 0 },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('DELETE operation failed', {
        correlationId,
        key,
        error: error.message,
        stack: error.stack,
        duration,
      });

      if (
        error instanceof RedisConnectionError ||
        error instanceof RedisOperationError
      ) {
        throw error;
      }

      throw new RedisOperationError(
        `Error deleting key '${key}': ${error.message}`,
        'delete',
        error
      );
    }
  }

  async keys({ pattern }) {
    try {
      if (!this.redis) {
        throw new Error('Not connected to Redis. Use connect tool first.');
      }

      const keys = await this.redis.keys(pattern || '*');

      const output = {
        pattern: pattern || '*',
        keys,
        total: keys.length,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      throw new Error(`Error getting keys: ${error.message}`);
    }
  }

  async info({ section }) {
    try {
      if (!this.redis) {
        throw new Error('Not connected to Redis. Use connect tool first.');
      }

      const info = await this.redis.info(section);

      return {
        content: [{ type: 'text', text: info }],
        structuredContent: { info },
      };
    } catch (error) {
      throw new Error(`Error getting Redis info: ${error.message}`);
    }
  }

  async monitorCache({ duration }) {
    try {
      if (!this.redis) {
        throw new Error('Not connected to Redis. Use connect tool first.');
      }

      const startTime = Date.now();
      const endTime = startTime + (duration || 60) * 1000;

      const stats = {
        hits: 0,
        misses: 0,
        commands: 0,
        memoryUsage: [],
        startTime: new Date(startTime).toISOString(),
      };

      // Monitor Redis INFO during the duration
      const monitorInterval = setInterval(async () => {
        try {
          const info = await this.redis.info('stats');
          const memoryInfo = await this.redis.info('memory');

          // Parse stats
          const statsMatch = info.match(
            /keyspace_hits:(\d+)\r\nkeyspace_misses:(\d+)/
          );
          if (statsMatch) {
            stats.hits = parseInt(statsMatch[1]);
            stats.misses = parseInt(statsMatch[2]);
          }

          // Parse memory usage
          const memoryMatch = memoryInfo.match(/used_memory:(\d+)/);
          if (memoryMatch) {
            stats.memoryUsage.push({
              timestamp: new Date().toISOString(),
              usedMemory: parseInt(memoryMatch[1]),
            });
          }

          stats.commands++;
        } catch (error) {
          console.error('Error during monitoring:', error);
        }
      }, 1000);

      // Wait for monitoring duration
      await new Promise((resolve) =>
        setTimeout(resolve, (duration || 60) * 1000)
      );

      clearInterval(monitorInterval);

      stats.endTime = new Date().toISOString();
      stats.duration = (Date.now() - startTime) / 1000;
      stats.hitRate =
        stats.hits + stats.misses > 0
          ? (stats.hits / (stats.hits + stats.misses)) * 100
          : 0;

      return {
        content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
        structuredContent: stats,
      };
    } catch (error) {
      throw new Error(`Error monitoring cache: ${error.message}`);
    }
  }

  async flushDb({ confirm }) {
    try {
      if (!this.redis) {
        throw new Error('Not connected to Redis. Use connect tool first.');
      }

      if (!confirm) {
        throw new Error(
          'Confirmation required. Set confirm=true to flush database.'
        );
      }

      await this.redis.flushdb();

      return {
        content: [{ type: 'text', text: 'Database flushed successfully' }],
        structuredContent: { message: 'Database flushed successfully' },
      };
    } catch (error) {
      throw new Error(`Error flushing database: ${error.message}`);
    }
  }

  async run() {
    try {
      // Start health check server if enabled
      if (this.config.server.enableHealthChecks) {
        const { HealthCheckServer } = require('./health-server');
        this.healthServer = new HealthCheckServer();
        await this.healthServer.start();
        this.logger.info('Health check server started', {
          port: this.config.server.healthCheckPort,
        });
      }

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      // Start MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.logger.info('Redis MCP server started successfully', {
        name: this.config.server.name,
        version: this.config.server.version,
        transport: 'stdio',
      });

      console.error('Redis MCP server running on stdio');
    } catch (error) {
      this.logger.error('Failed to start Redis MCP server', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Set up graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      this.logger.info('Received shutdown signal', { signal });

      try {
        // Close Redis connection
        if (this.redis) {
          await this.redis.disconnect();
          this.logger.info('Redis connection closed');
        }

        // Stop health check server
        if (this.healthServer) {
          await this.healthServer.stop();
          this.logger.info('Health check server stopped');
        }

        // Close MCP server
        if (this.server) {
          await this.server.close();
          this.logger.info('MCP server closed');
        }

        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during graceful shutdown', {
          error: error.message,
          stack: error.stack,
        });
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection', {
        reason: reason?.toString(),
        promise,
      });
      shutdown('unhandledRejection');
    });
  }
}

const server = new RedisMCPServer();
server.run().catch(console.error);
