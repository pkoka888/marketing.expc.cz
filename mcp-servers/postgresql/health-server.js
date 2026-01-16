const express = require('express');
const os = require('os');
const config = require('./config');
const logger = require('./logger');
const { databaseManager } = require('./database');

/**
 * Health Check Server for PostgreSQL MCP Server
 * Provides HTTP endpoints for health monitoring and metrics
 */

class HealthServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use(express.json());

    // Basic health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.getHealthStatus();
        const statusCode = health.healthy ? 200 : 503;

        res.status(statusCode).json(health);
        logger.logHealthCheck(health.healthy ? 'healthy' : 'unhealthy', health);
      } catch (error) {
        logger.logServerError(error, { endpoint: '/health' });
        res.status(500).json({
          healthy: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Detailed health check
    this.app.get('/health/detailed', async (req, res) => {
      try {
        const health = await this.getDetailedHealthStatus();
        const statusCode = health.overall.healthy ? 200 : 503;

        res.status(statusCode).json(health);
      } catch (error) {
        logger.logServerError(error, { endpoint: '/health/detailed' });
        res.status(500).json({
          overall: { healthy: false, error: error.message },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Readiness check
    this.app.get('/ready', async (req, res) => {
      try {
        const isReady = await this.isReady();
        const statusCode = isReady ? 200 : 503;

        res.status(statusCode).json({
          ready: isReady,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          ready: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        res.json(metrics);
      } catch (error) {
        logger.logServerError(error, { endpoint: '/metrics' });
        res.status(500).json({
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Liveness probe
    this.app.get('/live', (req, res) => {
      res.json({
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });
  }

  async getHealthStatus() {
    const dbHealth = await databaseManager.healthCheck();
    const systemHealth = this.getSystemHealth();

    const overallHealthy = dbHealth.healthy && systemHealth.healthy;

    return {
      healthy: overallHealthy,
      database: dbHealth,
      system: systemHealth,
      timestamp: new Date().toISOString(),
      version: config.server.version,
    };
  }

  async getDetailedHealthStatus() {
    const [dbHealth, dbStats] = await Promise.all([
      databaseManager.healthCheck(),
      databaseManager.getConnectionStats(),
    ]);

    const systemHealth = this.getSystemHealth();
    const overallHealthy = dbHealth.healthy && systemHealth.healthy;

    return {
      overall: {
        healthy: overallHealthy,
        status: overallHealthy ? 'healthy' : 'unhealthy',
      },
      database: {
        ...dbHealth,
        connectionStats: dbStats,
      },
      system: systemHealth,
      config: {
        database: {
          host: config.database.host,
          port: config.database.port,
          name: config.database.name,
          maxConnections: config.database.maxConnections,
        },
        circuitBreaker: databaseManager.circuitBreaker?.getState(),
        healthChecks: {
          enabled: config.healthChecks.enabled,
          interval: config.healthChecks.interval,
        },
      },
      timestamp: new Date().toISOString(),
      version: config.server.version,
    };
  }

  getSystemHealth() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsagePercent = memUsage.heapUsed / memUsage.heapTotal;

    const cpuUsage = os.loadavg()[0] / os.cpus().length; // 1-minute load average per CPU

    const memoryHealthy = memUsagePercent < config.healthChecks.memoryThreshold;
    const cpuHealthy = cpuUsage < config.healthChecks.cpuThreshold;

    return {
      healthy: memoryHealthy && cpuHealthy,
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        usagePercent: memUsagePercent,
        healthy: memoryHealthy,
        threshold: config.healthChecks.memoryThreshold,
      },
      cpu: {
        loadAverage: cpuUsage,
        healthy: cpuHealthy,
        threshold: config.healthChecks.cpuThreshold,
      },
      uptime: process.uptime(),
      platform: process.platform,
      nodeVersion: process.version,
    };
  }

  async isReady() {
    // Check if database is connected and responsive
    try {
      const dbHealth = await databaseManager.healthCheck();
      return dbHealth.healthy;
    } catch (error) {
      return false;
    }
  }

  async getMetrics() {
    const dbStats = await databaseManager.getConnectionStats();
    const memUsage = process.memoryUsage();

    return {
      database: {
        connections: {
          total: dbStats.totalCount || 0,
          idle: dbStats.idleCount || 0,
          waiting: dbStats.waitingCount || 0,
        },
        circuit_breaker: dbStats.circuitBreakerState || {},
        connected: dbStats.connected || false,
      },
      system: {
        memory: {
          heap_used: memUsage.heapUsed,
          heap_total: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss,
        },
        uptime: process.uptime(),
        cpu_load_average: os.loadavg(),
        platform: process.platform,
        node_version: process.version,
      },
      timestamp: new Date().toISOString(),
      version: config.server.version,
    };
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(config.server.healthCheckPort, () => {
          logger.info(
            `Health check server listening on port ${config.server.healthCheckPort}`
          );
          resolve();
        });

        this.server.on('error', (error) => {
          logger.logServerError(error, { context: 'health_server_start' });
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Health check server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Create singleton instance
const healthServer = new HealthServer();

module.exports = healthServer;
