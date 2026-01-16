#!/usr/bin/env node

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const {
  StdioServerTransport,
} = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  StreamableHTTPServerTransport,
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const express = require('express');
const client = require('prom-client');
const cron = require('node-cron');
const os = require('os-utils');
const fs = require('fs');
const path = require('path');

// Simple logger implementation
class SimpleLogger {
  constructor(config = {}) {
    this.level = config.level || 'info';
    this.enableConsole = config.enableConsole !== false;
    this.enableFile = config.enableFile || false;
    this.logFile = config.logFile;
  }

  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta,
    };

    if (this.enableConsole) {
      console.log(
        `[${timestamp}] ${level.toUpperCase()}: ${message}`,
        Object.keys(meta).length ? meta : ''
      );
    }

    if (this.enableFile && this.logFile) {
      // Simple file logging (could be enhanced)
      try {
        const fs = require('fs');
        const logLine = JSON.stringify(logEntry) + '\n';
        fs.appendFileSync(this.logFile, logLine);
      } catch (error) {
        console.error('Failed to write to log file:', error.message);
      }
    }
  }

  info(message, meta) {
    this.log('info', message, meta);
  }
  warn(message, meta) {
    this.log('warn', message, meta);
  }
  error(message, meta) {
    this.log('error', message, meta);
  }
  debug(message, meta) {
    this.log('debug', message, meta);
  }
}

// Simple circuit breaker implementation
class SimpleCircuitBreaker {
  constructor(config = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.recoveryTimeout = config.recoveryTimeout || 60000;
    this.state = 'closed'; // closed, open, half-open
    this.failures = 0;
    this.lastFailureTime = null;
  }

  async execute(operation, context = {}) {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = null;
  }
}

// Simple retry implementation
class SimpleRetry {
  constructor(config = {}) {
    this.maxAttempts = config.maxAttempts || 3;
    this.baseDelay = config.baseDelay || 1000;
    this.maxDelay = config.maxDelay || 10000;
    this.backoffMultiplier = config.backoffMultiplier || 2;
  }

  async execute(operation, context = {}) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === this.maxAttempts) {
          break;
        }

        const delay = Math.min(
          this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1),
          this.maxDelay
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// Simple error handler
class SimpleErrorHandler {
  constructor(config = {}) {
    this.retry = new SimpleRetry(config.retry);
    this.circuitBreaker = new SimpleCircuitBreaker(config.circuitBreaker);
    this.logger = config.logger || new SimpleLogger();
  }

  async executeAPIRequest(operation, context = {}) {
    const startTime = Date.now();

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await this.retry.execute(operation, context);
      }, context);

      return {
        success: true,
        data: result,
        metadata: {
          correlationId: context.correlationId || `req-${Date.now()}`,
          duration: Date.now() - startTime,
          retryCount: 0, // Simplified
          circuitBreakerState: this.circuitBreaker.getStats().state,
        },
      };
    } catch (error) {
      return {
        success: false,
        error,
        metadata: {
          correlationId: context.correlationId || `req-${Date.now()}`,
          duration: Date.now() - startTime,
          retryCount: 0, // Simplified
          circuitBreakerState: this.circuitBreaker.getStats().state,
        },
      };
    }
  }

  getHealthStats() {
    return {
      circuitBreaker: this.circuitBreaker.getStats(),
      overallHealth:
        this.circuitBreaker.getStats().state === 'closed' ? 100 : 50,
    };
  }
}

// Import configuration
const config = require('./config.js');

class MonitoringMCPServer {
  constructor() {
    // Initialize logger
    this.logger = new SimpleLogger({
      level: config.logging.level,
      enableConsole: config.logging.enableConsole,
      enableFile: config.logging.enableFile,
      logFile: config.logging.logFile,
    });

    // Initialize error handler
    this.errorHandler = new SimpleErrorHandler({
      retry: {
        maxAttempts: config.retry.maxAttempts,
        baseDelay: config.retry.baseDelay,
        maxDelay: config.retry.maxDelay,
        backoffMultiplier: config.retry.backoffMultiplier,
      },
      circuitBreaker: {
        failureThreshold: config.circuitBreaker.failureThreshold,
        recoveryTimeout: config.circuitBreaker.recoveryTimeout,
      },
      logger: this.logger,
    });

    // Initialize circuit breaker for metric collection
    this.metricsCircuitBreaker = new SimpleCircuitBreaker(
      config.circuitBreaker
    );

    // Initialize retry handler for operations
    this.retryHandler = new SimpleRetry({
      maxAttempts: config.retry.maxAttempts,
      baseDelay: config.retry.baseDelay,
      maxDelay: config.retry.maxDelay,
      backoffMultiplier: config.retry.backoffMultiplier,
    });

    // Create McpServer instance
    this.server = new McpServer({
      name: config.server.name,
      version: config.server.version,
    });

    // Server state
    this.metrics = {};
    this.alerts = [];
    this.alertThresholds = {};
    this.isMonitoring = false;
    this.monitoringJob = null;
    this.monitoringInterval = config.monitoring.defaultInterval;
    this.monitoringDuration = null;
    this.monitoringStartTime = null;

    // Health check state
    this.healthStatus = {
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      checks: {},
    };

    this.logger.info('Monitoring MCP Server initialized', {
      version: config.server.version,
      environment: config.environment,
    });

    this.setupMetrics();
    this.setupTools();
    this.setupHealthChecks();
  }

  setupMetrics() {
    // Create a Registry to register the metrics
    this.register = new client.Registry();

    // Add default metrics
    client.collectDefaultMetrics({ register: this.register });

    // Custom metrics
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'status_code', 'endpoint'],
    });

    this.responseTimeHistogram = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'endpoint'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    });

    this.activeConnections = new client.Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
    });

    this.errorRate = new client.Gauge({
      name: 'error_rate',
      help: 'Error rate percentage',
    });

    this.register.registerMetric(this.httpRequestsTotal);
    this.register.registerMetric(this.responseTimeHistogram);
    this.register.registerMetric(this.activeConnections);
    this.register.registerMetric(this.errorRate);
  }

  setupTools() {
    // Register get_metrics tool
    this.server.registerTool(
      'get_metrics',
      {
        title: 'Get Metrics',
        description: 'Get current system and application metrics',
        inputSchema: {
          format: {
            type: 'string',
            enum: ['prometheus', 'json'],
            default: 'json',
            description: 'Output format',
          },
          includeSystem: {
            type: 'boolean',
            default: true,
            description: 'Include system metrics',
          },
          includeApplication: {
            type: 'boolean',
            default: true,
            description: 'Include application metrics',
          },
        },
        outputSchema: {
          metrics: { type: 'object' },
          format: { type: 'string' },
          timestamp: { type: 'string' },
        },
      },
      async (args) => {
        try {
          return await this.getMetrics(args);
        } catch (error) {
          this.logger.error('Error in get_metrics tool', {
            error: error.message,
            args,
          });
          throw error;
        }
      }
    );

    // Register start_monitoring tool
    this.server.registerTool(
      'start_monitoring',
      {
        title: 'Start Monitoring',
        description: 'Start continuous system monitoring',
        inputSchema: {
          interval: {
            type: 'number',
            minimum: 1,
            maximum: 3600,
            default: config.monitoring.defaultInterval,
            description: 'Monitoring interval in seconds',
          },
          duration: {
            type: 'number',
            minimum: 1,
            description: 'Duration in seconds (optional)',
          },
        },
        outputSchema: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          interval: { type: 'number' },
          duration: { type: 'number' },
        },
      },
      async (args) => {
        try {
          return await this.startMonitoring(args);
        } catch (error) {
          this.logger.error('Error in start_monitoring tool', {
            error: error.message,
            args,
          });
          throw error;
        }
      }
    );

    // Register stop_monitoring tool
    this.server.registerTool(
      'stop_monitoring',
      {
        title: 'Stop Monitoring',
        description: 'Stop continuous monitoring',
        inputSchema: {},
        outputSchema: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          duration: { type: 'number' },
        },
      },
      async (args) => {
        try {
          return await this.stopMonitoring(args);
        } catch (error) {
          this.logger.error('Error in stop_monitoring tool', {
            error: error.message,
            args,
          });
          throw error;
        }
      }
    );

    // Register get_alerts tool
    this.server.registerTool(
      'get_alerts',
      {
        title: 'Get Alerts',
        description: 'Get current alerts and notifications',
        inputSchema: {
          severity: {
            type: 'string',
            enum: ['info', 'warning', 'critical'],
            description: 'Filter by severity',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 10,
            description: 'Maximum number of alerts to return',
          },
        },
        outputSchema: {
          alerts: { type: 'array' },
          total: { type: 'number' },
          filtered: { type: 'number' },
        },
      },
      async (args) => {
        try {
          return await this.getAlerts(args);
        } catch (error) {
          this.logger.error('Error in get_alerts tool', {
            error: error.message,
            args,
          });
          throw error;
        }
      }
    );

    // Register set_alert_threshold tool
    this.server.registerTool(
      'set_alert_threshold',
      {
        title: 'Set Alert Threshold',
        description: 'Set alert thresholds for monitoring',
        inputSchema: {
          metric: { type: 'string', description: 'Metric name' },
          threshold: { type: 'number', description: 'Threshold value' },
          operator: {
            type: 'string',
            enum: ['>', '<', '>=', '<=', '=='],
            default: '>',
            description: 'Comparison operator',
          },
          severity: {
            type: 'string',
            enum: ['info', 'warning', 'critical'],
            default: 'warning',
            description: 'Alert severity',
          },
        },
        outputSchema: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          threshold: { type: 'object' },
        },
      },
      async (args) => {
        try {
          return await this.setAlertThreshold(args);
        } catch (error) {
          this.logger.error('Error in set_alert_threshold tool', {
            error: error.message,
            args,
          });
          throw error;
        }
      }
    );

    // Register get_system_health tool
    this.server.registerTool(
      'get_system_health',
      {
        title: 'Get System Health',
        description: 'Get overall system health status',
        inputSchema: {
          detailed: {
            type: 'boolean',
            default: false,
            description: 'Include detailed information',
          },
        },
        outputSchema: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
          checks: { type: 'array' },
          system: { type: 'object' },
          application: { type: 'object' },
        },
      },
      async (args) => {
        try {
          return await this.getSystemHealth(args);
        } catch (error) {
          this.logger.error('Error in get_system_health tool', {
            error: error.message,
            args,
          });
          throw error;
        }
      }
    );

    // Register export_metrics tool
    this.server.registerTool(
      'export_metrics',
      {
        title: 'Export Metrics',
        description: 'Export metrics to file or external system',
        inputSchema: {
          format: {
            type: 'string',
            enum: ['json', 'csv', 'prometheus'],
            default: 'json',
            description: 'Export format',
          },
          output: { type: 'string', description: 'Output file path' },
        },
        outputSchema: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          format: { type: 'string' },
          output: { type: 'string' },
        },
      },
      async (args) => {
        try {
          return await this.exportMetrics(args);
        } catch (error) {
          this.logger.error('Error in export_metrics tool', {
            error: error.message,
            args,
          });
          throw error;
        }
      }
    );

    this.logger.info('All monitoring tools registered successfully');
  }

  setupHealthChecks() {
    if (!config.health.enabled) {
      this.logger.info('Health checks disabled');
      return;
    }

    const app = express();
    app.use(express.json());

    // Health check endpoint
    app.get(config.health.path, async (req, res) => {
      try {
        const health = await this.performHealthCheck();
        const statusCode =
          health.status === 'healthy'
            ? 200
            : health.status === 'warning'
              ? 200
              : 503;

        res.status(statusCode).json(health);
      } catch (error) {
        this.logger.error('Health check failed', { error: error.message });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message,
        });
      }
    });

    // Detailed health endpoint
    app.get(`${config.health.path}/detailed`, async (req, res) => {
      try {
        const health = await this.performDetailedHealthCheck();
        const statusCode =
          health.status === 'healthy'
            ? 200
            : health.status === 'warning'
              ? 200
              : 503;

        res.status(statusCode).json(health);
      } catch (error) {
        this.logger.error('Detailed health check failed', {
          error: error.message,
        });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message,
        });
      }
    });

    // Metrics endpoint for Prometheus
    app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.register.metrics();
        res.set('Content-Type', this.register.contentType);
        res.send(metrics);
      } catch (error) {
        this.logger.error('Metrics endpoint failed', { error: error.message });
        res.status(500).send('Error generating metrics');
      }
    });

    // Start health check server
    this.healthServer = app.listen(
      config.health.port,
      config.server.host,
      () => {
        this.logger.info('Health check server started', {
          port: config.health.port,
          path: config.health.path,
        });
      }
    );

    // Periodic health checks
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Periodic health check failed', {
          error: error.message,
        });
      }
    }, config.health.interval);
  }

  async getMetrics({
    format = 'json',
    includeSystem = true,
    includeApplication = true,
  }) {
    const correlationId = `metrics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info('Getting metrics', {
      correlationId,
      format,
      includeSystem,
      includeApplication,
    });

    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        system: {},
        application: {},
      };

      // Collect system metrics with circuit breaker and retry
      if (includeSystem) {
        const systemMetricsResult = await this.errorHandler.executeAPIRequest(
          async () => {
            return await this.metricsCircuitBreaker.execute(
              async () => await this.getSystemMetrics(),
              { correlationId, operation: 'getSystemMetrics' }
            );
          },
          {
            request: { type: 'get_system_metrics' },
            correlationId,
            model: 'system-monitor',
          }
        );

        if (systemMetricsResult.success) {
          metrics.system = systemMetricsResult.data;
        } else {
          this.logger.warn('Failed to collect system metrics', {
            correlationId,
            error: systemMetricsResult.error?.message,
          });
          metrics.system = { error: 'Failed to collect system metrics' };
        }
      }

      // Collect application metrics with circuit breaker and retry
      if (includeApplication) {
        const appMetricsResult = await this.errorHandler.executeAPIRequest(
          async () => {
            return await this.metricsCircuitBreaker.execute(
              async () => await this.getApplicationMetrics(),
              { correlationId, operation: 'getApplicationMetrics' }
            );
          },
          {
            request: { type: 'get_application_metrics' },
            correlationId,
            model: 'app-monitor',
          }
        );

        if (appMetricsResult.success) {
          metrics.application = appMetricsResult.data;
        } else {
          this.logger.warn('Failed to collect application metrics', {
            correlationId,
            error: appMetricsResult.error?.message,
          });
          metrics.application = {
            error: 'Failed to collect application metrics',
          };
        }
      }

      let output;
      if (format === 'prometheus') {
        const prometheusMetrics = await this.register.metrics();
        output = prometheusMetrics;
      } else {
        output = JSON.stringify(metrics, null, 2);
      }

      this.logger.info('Metrics collected successfully', {
        correlationId,
        format,
        hasSystemMetrics: !!metrics.system,
        hasAppMetrics: !!metrics.application,
      });

      return {
        content: [{ type: 'text', text: output }],
        structuredContent: {
          metrics,
          format,
          timestamp: metrics.timestamp,
        },
      };
    } catch (error) {
      this.logger.error('Error getting metrics', {
        correlationId,
        error: error.message,
      });
      throw new Error(`Error getting metrics: ${error.message}`);
    }
  }

  async getSystemMetrics() {
    return new Promise((resolve) => {
      const systemMetrics = {};

      os.cpuUsage((v) => {
        systemMetrics.cpuUsage = v;
      });

      systemMetrics.cpuCount = os.cpuCount();
      systemMetrics.freeMem = os.freemem();
      systemMetrics.totalMem = os.totalmem();
      systemMetrics.freeMemPercentage = os.freememPercentage();
      systemMetrics.loadAvg = os.loadavg(1);
      systemMetrics.platform = os.platform();
      systemMetrics.arch = os.arch();

      resolve(systemMetrics);
    });
  }

  async getApplicationMetrics() {
    const applicationMetrics = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      nodeVersion: process.version,
      pid: process.pid,
    };

    return applicationMetrics;
  }

  async startMonitoring({ interval, duration }) {
    try {
      if (this.isMonitoring) {
        throw new Error('Monitoring is already running');
      }

      this.isMonitoring = true;
      this.monitoringInterval = interval || 30;
      this.monitoringDuration = duration;
      this.monitoringStartTime = Date.now();

      this.monitoringJob = cron.schedule(
        `*/${this.monitoringInterval} * * * * *`,
        async () => {
          await this.collectMetrics();
          await this.checkAlerts();
        }
      );

      const message = `Monitoring started with ${this.monitoringInterval}s interval${duration ? ` for ${duration}s` : ''}`;

      // Stop monitoring after duration if specified
      if (duration) {
        setTimeout(() => {
          this.stopMonitoring({});
        }, duration * 1000);
      }

      return {
        content: [{ type: 'text', text: message }],
      };
    } catch (error) {
      throw new Error(`Error starting monitoring: ${error.message}`);
    }
  }

  async stopMonitoring() {
    try {
      if (!this.isMonitoring) {
        throw new Error('Monitoring is not running');
      }

      if (this.monitoringJob) {
        this.monitoringJob.stop();
      }

      this.isMonitoring = false;
      const duration = Date.now() - this.monitoringStartTime;

      const message = `Monitoring stopped after ${Math.round(duration / 1000)} seconds`;
      return {
        content: [{ type: 'text', text: message }],
      };
    } catch (error) {
      throw new Error(`Error stopping monitoring: ${error.message}`);
    }
  }

  async collectMetrics() {
    try {
      const systemMetrics = await this.getSystemMetrics();
      const applicationMetrics = await this.getApplicationMetrics();

      this.metrics[Date.now()] = {
        system: systemMetrics,
        application: applicationMetrics,
      };
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  async checkAlerts() {
    // Simple alert checking logic
    const latestMetrics = this.metrics[Object.keys(this.metrics).pop()];

    if (latestMetrics && latestMetrics.system) {
      const cpuUsage = latestMetrics.system.cpuUsage;
      const freeMemPercentage = latestMetrics.system.freeMemPercentage;

      if (cpuUsage > 0.8) {
        this.createAlert(
          'high_cpu_usage',
          'warning',
          `CPU usage is ${cpuUsage * 100}%`
        );
      }

      if (freeMemPercentage < 0.1) {
        this.createAlert(
          'low_memory',
          'critical',
          `Memory usage is ${Math.round((1 - freeMemPercentage) * 100)}%`
        );
      }
    }
  }

  createAlert(type, severity, message) {
    const alert = {
      id: Date.now(),
      type,
      severity,
      message,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  async getAlerts({ severity, limit = 10 }) {
    try {
      let filteredAlerts = [...this.alerts];

      if (severity) {
        filteredAlerts = filteredAlerts.filter(
          (alert) => alert.severity === severity
        );
      }

      if (limit) {
        filteredAlerts = filteredAlerts.slice(-limit);
      }

      const result = {
        total: this.alerts.length,
        filtered: filteredAlerts.length,
        alerts: filteredAlerts,
      };

      this.logger.info('Retrieved alerts', {
        total: result.total,
        filtered: result.filtered,
        severity: severity || 'all',
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      this.logger.error('Error getting alerts', {
        error: error.message,
        severity,
        limit,
      });
      throw new Error(`Error getting alerts: ${error.message}`);
    }
  }

  async setAlertThreshold({ metric, threshold, operator, severity }) {
    try {
      // Store alert thresholds
      if (!this.alertThresholds) {
        this.alertThresholds = {};
      }

      this.alertThresholds[metric] = {
        threshold,
        operator,
        severity,
        lastChecked: null,
      };

      const message = `Alert threshold set for ${metric}: ${operator} ${threshold} (${severity})`;
      return {
        content: [{ type: 'text', text: message }],
      };
    } catch (error) {
      throw new Error(`Error setting alert threshold: ${error.message}`);
    }
  }

  async getSystemHealth({ detailed }) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: [],
      };

      // CPU check
      const cpuUsage = await new Promise((resolve) => {
        os.cpuUsage(resolve);
      });

      if (cpuUsage > 0.8) {
        health.status = 'warning';
        health.checks.push({
          name: 'cpu_usage',
          status: 'warning',
          value: cpuUsage,
          threshold: 0.8,
        });
      } else {
        health.checks.push({
          name: 'cpu_usage',
          status: 'healthy',
          value: cpuUsage,
        });
      }

      // Memory check
      const freeMemPercentage = os.freememPercentage();
      if (freeMemPercentage < 0.1) {
        health.status = 'critical';
        health.checks.push({
          name: 'memory_usage',
          status: 'critical',
          value: 1 - freeMemPercentage,
          threshold: 0.9,
        });
      } else {
        health.checks.push({
          name: 'memory_usage',
          status: 'healthy',
          value: 1 - freeMemPercentage,
        });
      }

      // Disk check (simplified)
      const diskUsage = await this.getDiskUsage();
      if (diskUsage > 0.9) {
        health.status = 'critical';
        health.checks.push({
          name: 'disk_usage',
          status: 'critical',
          value: diskUsage,
          threshold: 0.9,
        });
      } else {
        health.checks.push({
          name: 'disk_usage',
          status: 'healthy',
          value: diskUsage,
        });
      }

      if (detailed) {
        health.system = await this.getSystemMetrics();
        health.application = await this.getApplicationMetrics();
        health.alerts = this.alerts.slice(-10);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(health, null, 2) }],
      };
    } catch (error) {
      throw new Error(`Error getting system health: ${error.message}`);
    }
  }

  async getDiskUsage() {
    return new Promise((resolve) => {
      try {
        const stats = fs.statSync(process.cwd());
        // Simplified disk usage calculation
        resolve(0.5); // Placeholder
      } catch (error) {
        resolve(0);
      }
    });
  }

  async exportMetrics({ format, output }) {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        metrics: this.metrics,
        alerts: this.alerts,
        thresholds: this.alertThresholds || {},
      };

      let content;
      if (format === 'json') {
        content = JSON.stringify(exportData, null, 2);
      } else if (format === 'csv') {
        content = this.convertToCSV(exportData);
      } else if (format === 'prometheus') {
        content = await this.register.metrics();
      }

      if (output) {
        fs.writeFileSync(output, content);
        const message = `Metrics exported to ${output} in ${format} format`;
        return {
          content: [{ type: 'text', text: message }],
        };
      } else {
        return {
          content: [{ type: 'text', text: content }],
        };
      }
    } catch (error) {
      throw new Error(`Error exporting metrics: ${error.message}`);
    }
  }

  convertToCSV(data) {
    // Simple CSV conversion for metrics
    const headers = ['timestamp', 'cpu_usage', 'memory_usage', 'free_memory'];
    const rows = Object.entries(data.metrics).map(([timestamp, metrics]) => [
      timestamp,
      metrics.system.cpuUsage,
      1 - metrics.system.freeMemPercentage,
      metrics.system.freeMem,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  async performHealthCheck() {
    const timestamp = new Date().toISOString();
    const checks = {};

    // CPU check
    try {
      const cpuUsage = await new Promise((resolve) => {
        os.cpuUsage(resolve);
      });
      checks.cpu = {
        status: cpuUsage > config.thresholds.cpuUsage ? 'warning' : 'healthy',
        value: cpuUsage,
        threshold: config.thresholds.cpuUsage,
      };
    } catch (error) {
      checks.cpu = { status: 'error', error: error.message };
    }

    // Memory check
    try {
      const freeMemPercentage = os.freememPercentage();
      checks.memory = {
        status:
          freeMemPercentage < 1 - config.thresholds.memoryUsage
            ? 'critical'
            : 'healthy',
        value: 1 - freeMemPercentage,
        threshold: config.thresholds.memoryUsage,
      };
    } catch (error) {
      checks.memory = { status: 'error', error: error.message };
    }

    // Circuit breaker check
    const circuitBreakerStats = this.metricsCircuitBreaker.getStats();
    checks.circuitBreaker = {
      status:
        circuitBreakerStats.state === 'open'
          ? 'critical'
          : circuitBreakerStats.state === 'half-open'
            ? 'warning'
            : 'healthy',
      state: circuitBreakerStats.state,
      failures: circuitBreakerStats.failures,
    };

    // Overall status
    const hasCritical = Object.values(checks).some(
      (check) => check.status === 'critical'
    );
    const hasWarning = Object.values(checks).some(
      (check) => check.status === 'warning'
    );
    const hasError = Object.values(checks).some(
      (check) => check.status === 'error'
    );

    let overallStatus = 'healthy';
    if (hasCritical || hasError) overallStatus = 'critical';
    else if (hasWarning) overallStatus = 'warning';

    this.healthStatus = {
      status: overallStatus,
      timestamp,
      checks,
      uptime: process.uptime(),
      version: config.server.version,
    };

    return this.healthStatus;
  }

  async performDetailedHealthCheck() {
    const health = await this.performHealthCheck();

    // Add detailed system and application metrics
    try {
      health.system = await this.getSystemMetrics();
    } catch (error) {
      health.system = { error: error.message };
    }

    try {
      health.application = await this.getApplicationMetrics();
    } catch (error) {
      health.application = { error: error.message };
    }

    // Add monitoring status
    health.monitoring = {
      isActive: this.isMonitoring,
      interval: this.monitoringInterval,
      startTime: this.monitoringStartTime,
      metricsCount: Object.keys(this.metrics).length,
      alertsCount: this.alerts.length,
    };

    // Add error handler stats
    health.errorHandler = this.errorHandler.getHealthStats();

    return health;
  }

  async run() {
    try {
      // Start MCP server with stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.logger.info('Monitoring MCP server started successfully', {
        transport: 'stdio',
        version: config.server.version,
        environment: config.environment,
      });

      // Graceful shutdown handling
      process.on('SIGINT', async () => {
        await this.shutdown();
      });

      process.on('SIGTERM', async () => {
        await this.shutdown();
      });
    } catch (error) {
      this.logger.error('Failed to start Monitoring MCP server', {
        error: error.message,
      });
      throw error;
    }
  }

  async shutdown() {
    this.logger.info('Shutting down Monitoring MCP server...');

    // Stop monitoring
    if (this.isMonitoring) {
      await this.stopMonitoring({});
    }

    // Stop health check server
    if (this.healthServer) {
      this.healthServer.close();
    }

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close circuit breaker
    this.metricsCircuitBreaker.reset();

    this.logger.info('Monitoring MCP server shut down successfully');
    process.exit(0);
  }
}

const server = new MonitoringMCPServer();
server.run().catch(console.error);
