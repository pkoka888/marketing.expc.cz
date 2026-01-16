const winston = require('winston');
const path = require('path');
const config = require('./config');

/**
 * PostgreSQL MCP Server Logger
 * Structured logging with Winston for database operations and server events
 */

class PostgreSQLLogger {
  constructor() {
    this.logger = this.createLogger();
  }

  createLogger() {
    const transports = [];

    // Console transport
    if (config.logging.enableConsole) {
      transports.push(
        new winston.transports.Console({
          level: config.logging.level,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length
                ? ` ${JSON.stringify(meta)}`
                : '';
              return `${timestamp} [${level}]: ${message}${metaStr}`;
            })
          ),
        })
      );
    }

    // File transport
    if (config.logging.enableFile) {
      // Ensure logs directory exists
      const fs = require('fs');
      const logDir = path.dirname(config.logging.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      transports.push(
        new winston.transports.File({
          filename: config.logging.logFile,
          level: config.logging.level,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
          maxsize: this.parseFileSize(config.logging.maxFileSize),
          maxFiles: config.logging.maxFiles,
        })
      );
    }

    return winston.createLogger({
      level: config.logging.level,
      transports,
      exitOnError: false,
    });
  }

  parseFileSize(sizeStr) {
    const units = {
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    const match = sizeStr.toLowerCase().match(/^(\d+)([kmg]?)$/);
    if (!match) return 10 * 1024 * 1024; // Default 10MB

    const [, size, unit] = match;
    return parseInt(size) * (units[unit] || 1);
  }

  // Database operation logging
  logDatabaseOperation(operation, details = {}) {
    this.logger.info(`Database ${operation}`, {
      operation,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  logDatabaseError(operation, error, details = {}) {
    this.logger.error(`Database ${operation} failed`, {
      operation,
      error: error.message,
      stack: error.stack,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  logConnectionEvent(event, details = {}) {
    this.logger.info(`Database connection ${event}`, {
      event,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  logQueryExecution(query, params, duration, result = {}) {
    this.logger.debug('Query executed', {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      paramsCount: params ? params.length : 0,
      duration,
      rowsAffected: result.rowCount || result.rows?.length || 0,
      timestamp: new Date().toISOString(),
    });
  }

  logHealthCheck(status, details = {}) {
    this.logger.info('Health check performed', {
      status,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  logCircuitBreakerEvent(event, details = {}) {
    this.logger.warn(`Circuit breaker ${event}`, {
      event,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  logRetryAttempt(operation, attempt, error, details = {}) {
    this.logger.warn(`Retry attempt ${attempt} for ${operation}`, {
      operation,
      attempt,
      error: error.message,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  // Server lifecycle logging
  logServerStart(details = {}) {
    this.logger.info('PostgreSQL MCP Server starting', {
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  logServerStop(details = {}) {
    this.logger.info('PostgreSQL MCP Server stopping', {
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  logServerError(error, details = {}) {
    this.logger.error('PostgreSQL MCP Server error', {
      error: error.message,
      stack: error.stack,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  // Performance monitoring
  logPerformanceMetrics(metrics) {
    this.logger.info('Performance metrics collected', {
      ...metrics,
      timestamp: new Date().toISOString(),
    });
  }

  // MCP operation logging
  logMCPOperation(tool, args, result = {}, duration) {
    this.logger.debug(`MCP tool executed: ${tool}`, {
      tool,
      args: this.sanitizeArgs(args),
      duration,
      success: !result.error,
      error: result.error?.message,
      timestamp: new Date().toISOString(),
    });
  }

  sanitizeArgs(args) {
    const sanitized = { ...args };
    // Remove sensitive information
    if (sanitized.password) {
      sanitized.password = '[REDACTED]';
    }
    return sanitized;
  }

  // Utility methods
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }
}

// Create singleton instance
const logger = new PostgreSQLLogger();

module.exports = logger;
