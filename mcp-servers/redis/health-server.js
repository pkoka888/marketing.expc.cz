#!/usr/bin/env node

const express = require('express');
const Redis = require('ioredis');
const { getConfig } = require('./config');
const { kiloCodeLogger } = require('@kilo-code/error-handling/logger');

class HealthCheckServer {
  constructor() {
    this.config = getConfig();
    this.logger = kiloCodeLogger.createLogger('redis-health-check');
    this.app = express();
    this.redis = null;
    this.setupRoutes();
  }

  setupRoutes() {
    // Basic health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.checkHealth();
        const statusCode = health.status === 'healthy' ? 200 : 503;

        res.status(statusCode).json({
          status: health.status,
          timestamp: new Date().toISOString(),
          checks: health.checks,
          uptime: process.uptime(),
        });
      } catch (error) {
        this.logger.error('Health check failed', { error: error.message });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message,
        });
      }
    });

    // Readiness check
    this.app.get('/ready', async (req, res) => {
      try {
        const isReady = await this.checkReadiness();
        const statusCode = isReady ? 200 : 503;

        res.status(statusCode).json({
          ready: isReady,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error('Readiness check failed', { error: error.message });
        res.status(503).json({
          ready: false,
          timestamp: new Date().toISOString(),
          error: error.message,
        });
      }
    });

    // Detailed health check
    this.app.get('/health/detailed', async (req, res) => {
      try {
        const health = await this.checkDetailedHealth();

        res.json({
          status: health.overall,
          timestamp: new Date().toISOString(),
          checks: health.checks,
          metrics: health.metrics,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        });
      } catch (error) {
        this.logger.error('Detailed health check failed', {
          error: error.message,
        });
        res.status(503).json({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error.message,
        });
      }
    });
  }

  async checkHealth() {
    const checks = {
      redis: await this.checkRedisConnection(),
      memory: this.checkMemoryUsage(),
      uptime: this.checkUptime(),
    };

    const allHealthy = Object.values(checks).every(
      (check) => check.status === 'healthy'
    );
    const status = allHealthy ? 'healthy' : 'unhealthy';

    return { status, checks };
  }

  async checkReadiness() {
    try {
      // Check if Redis connection is available
      if (!this.redis) {
        await this.connectRedis();
      }

      await this.redis.ping();
      return true;
    } catch (error) {
      this.logger.warn('Readiness check failed', { error: error.message });
      return false;
    }
  }

  async checkDetailedHealth() {
    const checks = {
      redis: await this.checkRedisConnection(),
      memory: this.checkMemoryUsage(),
      uptime: this.checkUptime(),
      performance: await this.checkPerformance(),
    };

    const metrics = await this.getRedisMetrics();

    const allHealthy = Object.values(checks).every(
      (check) => check.status === 'healthy'
    );
    const overall = allHealthy ? 'healthy' : 'degraded';

    return { overall, checks, metrics };
  }

  async checkRedisConnection() {
    try {
      if (!this.redis) {
        await this.connectRedis();
      }

      const startTime = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        message: 'Redis connection is healthy',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'Redis connection failed',
      };
    }
  }

  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    };

    // Consider unhealthy if heap usage is > 90%
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const status = heapUsagePercent > 90 ? 'warning' : 'healthy';

    return {
      status,
      usage: memUsageMB,
      percentage: Math.round(heapUsagePercent),
      message: `Memory usage: ${memUsageMB.heapUsed}MB/${memUsageMB.heapTotal}MB`,
    };
  }

  checkUptime() {
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    return {
      status: 'healthy',
      uptime,
      formatted: `${uptimeHours}h ${uptimeMinutes}m`,
      message: `Server uptime: ${uptimeHours}h ${uptimeMinutes}m`,
    };
  }

  async checkPerformance() {
    try {
      if (!this.redis) {
        await this.connectRedis();
      }

      const startTime = Date.now();

      // Perform a simple SET/GET operation
      const testKey = `health-check-${Date.now()}`;
      await this.redis.set(testKey, 'test-value');
      await this.redis.get(testKey);
      await this.redis.del(testKey);

      const operationTime = Date.now() - startTime;

      return {
        status: operationTime > 1000 ? 'warning' : 'healthy',
        operationTime,
        message: `Redis operation took ${operationTime}ms`,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'Performance check failed',
      };
    }
  }

  async getRedisMetrics() {
    try {
      if (!this.redis) {
        await this.connectRedis();
      }

      const info = await this.redis.info();
      const stats = {};

      // Parse key metrics from INFO
      const lines = info.split('\r\n');
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          if (
            [
              'connected_clients',
              'total_connections_received',
              'total_commands_processed',
              'keyspace_hits',
              'keyspace_misses',
              'used_memory',
              'uptime_in_seconds',
            ].includes(key)
          ) {
            stats[key] = isNaN(value) ? value : parseInt(value);
          }
        }
      }

      return stats;
    } catch (error) {
      this.logger.warn('Failed to get Redis metrics', { error: error.message });
      return {};
    }
  }

  async connectRedis() {
    if (this.redis) {
      return;
    }

    const redisConfig = this.config.redis;
    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      username: redisConfig.username,
      tls: redisConfig.tls ? {} : undefined,
      lazyConnect: false,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      connectTimeout: this.config.timeout.connectionTimeout,
      commandTimeout: this.config.timeout.operationTimeout,
    });

    // Handle connection events
    this.redis.on('connect', () => {
      this.logger.info('Health check Redis connection established');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Health check Redis connection error', {
        error: error.message,
      });
    });

    this.redis.on('close', () => {
      this.logger.warn('Health check Redis connection closed');
    });
  }

  async start() {
    try {
      const port = this.config.server.healthCheckPort;

      this.server = this.app.listen(port, () => {
        this.logger.info(`Health check server started on port ${port}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.stop());
      process.on('SIGINT', () => this.stop());
    } catch (error) {
      this.logger.error('Failed to start health check server', {
        error: error.message,
      });
      throw error;
    }
  }

  async stop() {
    this.logger.info('Stopping health check server');

    if (this.server) {
      this.server.close();
    }

    if (this.redis) {
      await this.redis.disconnect();
    }

    process.exit(0);
  }
}

// Start health check server if run directly
if (require.main === module) {
  const healthServer = new HealthCheckServer();
  healthServer.start().catch(console.error);
}

module.exports = { HealthCheckServer };
