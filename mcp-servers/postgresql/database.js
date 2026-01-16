const { Pool } = require('pg');
const config = require('./config');
const logger = require('./logger');

/**
 * PostgreSQL Database Connection Manager
 * Handles connection pooling, circuit breaker, and retry logic
 */

class DatabaseError extends Error {
  constructor(message, code, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.originalError = originalError;
  }
}

class CircuitBreaker {
  constructor(
    failureThreshold = 5,
    recoveryTimeout = 60000,
    monitoringPeriod = 10000
  ) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.monitoringPeriod = monitoringPeriod;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'closed'; // closed, open, half-open
    this.nextAttemptTime = null;
  }

  async execute(operation) {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttemptTime) {
        throw new DatabaseError('Circuit breaker is open', 'CIRCUIT_OPEN');
      }
      this.state = 'half-open';
      logger.logCircuitBreakerEvent('half-open');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
    this.nextAttemptTime = null;
  }

  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      this.nextAttemptTime = Date.now() + this.recoveryTimeout;
      logger.logCircuitBreakerEvent('opened', {
        failureCount: this.failureCount,
        nextAttemptIn: this.recoveryTimeout,
      });
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttemptTime: this.nextAttemptTime,
      timeUntilNextAttempt: this.nextAttemptTime
        ? Math.max(0, this.nextAttemptTime - Date.now())
        : 0,
    };
  }
}

class RetryHandler {
  constructor(
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryableErrors = []
  ) {
    this.maxAttempts = maxAttempts;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.backoffMultiplier = backoffMultiplier;
    this.retryableErrors = new Set(retryableErrors);
  }

  async execute(operation, context = '') {
    let lastError;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!this.isRetryableError(error) || attempt === this.maxAttempts) {
          throw error;
        }

        const delay = Math.min(
          this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1),
          this.maxDelay
        );
        logger.logRetryAttempt(context, attempt, error, { delay });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  isRetryableError(error) {
    // Check PostgreSQL error codes
    if (error.code && this.retryableErrors.has(error.code)) {
      return true;
    }

    // Check Node.js error codes
    if (error.code && this.retryableErrors.has(error.code)) {
      return true;
    }

    // Check error message patterns
    const message = error.message?.toLowerCase() || '';
    return (
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('temporary')
    );
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreaker.failureThreshold,
      config.circuitBreaker.recoveryTimeout,
      config.circuitBreaker.monitoringPeriod
    );
    this.retryHandler = new RetryHandler(
      config.retry.maxAttempts,
      config.retry.baseDelay,
      config.retry.maxDelay,
      config.retry.backoffMultiplier,
      config.retry.retryableErrors
    );

    this.healthCheckInterval = null;
    this.setupHealthChecks();
  }

  setupHealthChecks() {
    if (config.healthChecks.enabled) {
      this.healthCheckInterval = setInterval(() => {
        this.performHealthCheck();
      }, config.healthChecks.interval);
    }
  }

  async performHealthCheck() {
    try {
      if (this.pool && this.isConnected) {
        const client = await this.pool.connect();
        await client.query('SELECT 1');
        client.release();

        logger.logHealthCheck('healthy', {
          poolTotalCount: this.pool.totalCount,
          poolIdleCount: this.pool.idleCount,
          poolWaitingCount: this.pool.waitingCount,
        });
      } else {
        logger.logHealthCheck('unhealthy', { reason: 'not connected' });
      }
    } catch (error) {
      logger.logHealthCheck('unhealthy', { error: error.message });
    }
  }

  async connect(connectionConfig = {}) {
    try {
      if (this.pool) {
        await this.disconnect();
      }

      const poolConfig = {
        host: connectionConfig.host || config.database.host,
        port: connectionConfig.port || config.database.port,
        database: connectionConfig.database || config.database.name,
        user: connectionConfig.user || config.database.user,
        password: connectionConfig.password || config.database.password,
        ssl:
          connectionConfig.ssl !== undefined
            ? connectionConfig.ssl
            : config.database.ssl,
        max: config.database.maxConnections,
        idleTimeoutMillis: config.database.idleTimeoutMillis,
        connectionTimeoutMillis: config.database.connectionTimeoutMillis,
      };

      logger.logConnectionEvent('connecting', {
        host: poolConfig.host,
        port: poolConfig.port,
        database: poolConfig.database,
      });

      this.pool = new Pool(poolConfig);

      // Set up event handlers
      this.pool.on('connect', (client) => {
        logger.logConnectionEvent('client_connected');
      });

      this.pool.on('error', (err, client) => {
        logger.logDatabaseError('pool_error', err);
        this.isConnected = false;
      });

      this.pool.on('remove', (client) => {
        logger.logConnectionEvent('client_removed');
      });

      // Test connection
      await this.retryHandler.execute(async () => {
        return this.circuitBreaker.execute(async () => {
          const client = await this.pool.connect();
          await client.query('SELECT 1');
          client.release();
        });
      }, 'connection_test');

      this.isConnected = true;

      logger.logConnectionEvent('connected', {
        host: poolConfig.host,
        port: poolConfig.port,
        database: poolConfig.database,
      });

      return {
        host: poolConfig.host,
        port: poolConfig.port,
        database: poolConfig.database,
      };
    } catch (error) {
      this.isConnected = false;
      logger.logDatabaseError('connection_failed', error);
      throw new DatabaseError(
        `Failed to connect to database: ${error.message}`,
        'CONNECTION_FAILED',
        error
      );
    }
  }

  async disconnect() {
    if (this.pool) {
      logger.logConnectionEvent('disconnecting');
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.logConnectionEvent('disconnected');
    }
  }

  async query(sql, params = [], options = {}) {
    if (!this.isConnected || !this.pool) {
      throw new DatabaseError('Not connected to database', 'NOT_CONNECTED');
    }

    const startTime = Date.now();

    try {
      const result = await this.retryHandler.execute(async () => {
        return this.circuitBreaker.execute(async () => {
          const client = await this.pool.connect();
          try {
            const queryConfig = {
              text: sql,
              values: params,
              timeout: options.timeout || config.database.queryTimeout,
            };

            const result = await client.query(queryConfig);
            return result;
          } finally {
            client.release();
          }
        });
      }, 'query_execution');

      const duration = Date.now() - startTime;
      logger.logQueryExecution(sql, params, duration, result);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logDatabaseError('query_failed', error, {
        sql: sql.substring(0, 100),
        paramsCount: params.length,
        duration,
      });
      throw new DatabaseError(
        `Query failed: ${error.message}`,
        'QUERY_FAILED',
        error
      );
    }
  }

  async getConnectionStats() {
    if (!this.pool) {
      return { connected: false };
    }

    return {
      connected: this.isConnected,
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      circuitBreakerState: this.circuitBreaker.getState(),
    };
  }

  async healthCheck() {
    const stats = await this.getConnectionStats();

    if (!stats.connected) {
      return { healthy: false, reason: 'not connected' };
    }

    try {
      await this.query('SELECT 1');
      return {
        healthy: true,
        stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        reason: error.message,
        stats,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async gracefulShutdown() {
    logger.logServerStop({ reason: 'graceful_shutdown' });

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.disconnect();
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

module.exports = {
  DatabaseManager,
  DatabaseError,
  databaseManager,
};
