#!/usr/bin/env node

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const {
  StdioServerTransport,
} = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');

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

  reset() {
    this.circuitBreaker.reset();
  }
}

// Import configuration
const config = require('./config.js');

class PlaywrightMCPServer {
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

    // Create McpServer instance
    this.server = new McpServer({
      name: config.server.name,
      version: config.server.version,
    });

    // Server state
    this.healthStatus = {
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      checks: {},
    };

    this.logger.info('Playwright MCP Server initialized', {
      version: config.server.version,
      environment: config.environment,
    });

    this.setupToolHandlers();
    this.setupHealthChecks();
  }

  setupToolHandlers() {
    // Register run_tests tool
    this.server.registerTool(
      'run_tests',
      {
        title: 'Run Tests',
        description: 'Run Playwright tests with various options',
        inputSchema: {
          type: 'object',
          properties: {
            testPattern: {
              type: 'string',
              description: 'Glob pattern for test files',
            },
            browser: {
              type: 'string',
              enum: ['chromium', 'firefox', 'webkit'],
              default: config.playwright.defaultBrowser,
              description: 'Browser to use',
            },
            headless: {
              type: 'boolean',
              default: config.playwright.defaultHeadless,
              description: 'Run in headless mode',
            },
            parallel: {
              type: 'boolean',
              default: config.playwright.defaultParallel,
              description: 'Run tests in parallel',
            },
            reporter: {
              type: 'string',
              enum: ['list', 'json', 'html', 'junit'],
              default: config.playwright.defaultReporter,
              description: 'Test reporter format',
            },
          },
        },
      },
      async (args) => {
        try {
          return await this.runTests(args);
        } catch (error) {
          this.logger.error('Error in run_tests tool', {
            error: error.message,
            args,
          });
          throw error;
        }
      }
    );

    // Register generate_test tool
    this.server.registerTool(
      'generate_test',
      {
        title: 'Generate Test',
        description: 'Generate new Playwright test file from template',
        inputSchema: {
          type: 'object',
          required: ['testName', 'pageUrl'],
          properties: {
            testName: {
              type: 'string',
              description: 'Name of the test',
            },
            pageUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL of the page to test',
            },
            testDescription: {
              type: 'string',
              description: 'Description of the test',
            },
            testSteps: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of test steps',
            },
          },
        },
      },
      async (args) => {
        try {
          return await this.generateTest(args);
        } catch (error) {
          this.logger.error('Error in generate_test tool', {
            error: error.message,
            args,
          });
          throw error;
        }
      }
    );

    // Register get_test_results tool
    this.server.registerTool(
      'get_test_results',
      {
        title: 'Get Test Results',
        description: 'Get latest test results and reports',
        inputSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['json', 'html', 'junit'],
              default: 'json',
              description: 'Format of results',
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: config.limits.maxTestFiles,
              default: 10,
              description: 'Maximum number of results to return',
            },
          },
        },
      },
      async (args) => {
        try {
          return await this.getTestResults(args);
        } catch (error) {
          this.logger.error('Error in get_test_results tool', {
            error: error.message,
            args,
          });
          throw error;
        }
      }
    );

    // Register debug_test tool
    this.server.registerTool(
      'debug_test',
      {
        title: 'Debug Test',
        description: 'Debug a specific test with trace viewer',
        inputSchema: {
          type: 'object',
          required: ['testFile'],
          properties: {
            testFile: {
              type: 'string',
              description: 'Path to the test file',
            },
            browser: {
              type: 'string',
              enum: ['chromium', 'firefox', 'webkit'],
              default: config.playwright.defaultBrowser,
              description: 'Browser to use for debugging',
            },
          },
        },
      },
      async (args) => {
        try {
          return await this.debugTest(args);
        } catch (error) {
          this.logger.error('Error in debug_test tool', {
            error: error.message,
            args,
          });
          throw error;
        }
      }
    );

    this.logger.info('All Playwright tools registered successfully');
  }

  async runTests({ testPattern, browser, headless, parallel, reporter }) {
    const correlationId = `run-tests-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info('Running Playwright tests', {
      correlationId,
      testPattern,
      browser,
      headless,
      parallel,
      reporter,
    });

    try {
      // Execute with error handling and circuit breaker
      const result = await this.errorHandler.executeAPIRequest(
        async () => {
          const options = [];

          if (testPattern) options.push(testPattern);
          if (browser) options.push(`--browser=${browser}`);
          if (headless !== undefined) options.push(`--headless=${headless}`);
          if (parallel !== undefined)
            options.push(
              `--workers=${parallel ? config.playwright.workers : 1}`
            );
          if (reporter) options.push(`--reporter=${reporter}`);

          // Add timeout
          options.push(`--timeout=${config.playwright.testTimeout}`);
          options.push(`--global-timeout=${config.playwright.globalTimeout}`);

          const command = `npx playwright test ${options.join(' ')}`;
          const output = execSync(command, {
            encoding: 'utf8',
            cwd: process.cwd(),
            timeout: config.limits.maxTestDuration,
          });

          return { output, exitCode: 0 };
        },
        {
          request: { type: 'run_tests', testPattern, browser },
          correlationId,
          model: 'playwright-test-runner',
        }
      );

      if (result.success) {
        this.logger.info('Tests completed successfully', {
          correlationId,
          exitCode: result.data.exitCode,
        });

        return {
          content: [{ type: 'text', text: result.data.output }],
          isError: false,
        };
      } else {
        this.logger.error('Tests failed', {
          correlationId,
          error: result.error?.message,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Error running tests: ${result.error?.message}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      this.logger.error('Error in runTests', {
        correlationId,
        error: error.message,
      });
      throw new Error(`Error running tests: ${error.message}`);
    }
  }

  async generateTest({ testName, pageUrl, testDescription, testSteps }) {
    const correlationId = `generate-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info('Generating Playwright test', {
      correlationId,
      testName,
      pageUrl,
      testDescription,
    });

    try {
      const result = await this.errorHandler.executeAPIRequest(
        async () => {
          const testDir = path.join(process.cwd(), 'tests');
          await fs.ensureDir(testDir);

          const testContent = `import { test, expect } from '@playwright/test';

test.describe('${testName}', () => {
  test('${testDescription || 'should work correctly'}', async ({ page }) => {
    // Navigate to the page
    await page.goto('${pageUrl}');

    // Add test steps
    ${testSteps ? testSteps.map((step) => `    await ${step};`).join('\n    ') : '    // Add your test steps here'}

    // Add assertions
    await expect(page).toHaveTitle(/Expected Title/);
  });
});
`;

          const testFile = path.join(
            testDir,
            `${testName.toLowerCase().replace(/\s+/g, '-')}.spec.ts`
          );
          await fs.writeFile(testFile, testContent);

          return {
            message: `Test file created: ${testFile}`,
            filePath: testFile,
            content: testContent,
          };
        },
        {
          request: { type: 'generate_test', testName, pageUrl },
          correlationId,
          model: 'playwright-test-generator',
        }
      );

      if (result.success) {
        this.logger.info('Test generated successfully', {
          correlationId,
          filePath: result.data.filePath,
        });

        return {
          content: [
            {
              type: 'text',
              text: `${result.data.message}\n\nContent:\n${result.data.content}`,
            },
          ],
          isError: false,
        };
      } else {
        this.logger.error('Test generation failed', {
          correlationId,
          error: result.error?.message,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Error generating test: ${result.error?.message}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      this.logger.error('Error in generateTest', {
        correlationId,
        error: error.message,
      });
      throw new Error(`Error generating test: ${error.message}`);
    }
  }

  async getTestResults({ format, limit }) {
    const correlationId = `get-results-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info('Getting test results', {
      correlationId,
      format,
      limit,
    });

    try {
      const result = await this.errorHandler.executeAPIRequest(
        async () => {
          const resultsDir = path.join(process.cwd(), 'test-results');
          const reportsDir = path.join(process.cwd(), 'playwright-report');

          let results = [];

          if (format === 'json' && (await fs.pathExists(resultsDir))) {
            const files = await fs.readdir(resultsDir);
            const jsonFiles = files
              .filter((f) => f.endsWith('.json'))
              .slice(0, Math.min(limit, config.limits.maxTestFiles));

            for (const file of jsonFiles) {
              const content = await fs.readFile(
                path.join(resultsDir, file),
                'utf8'
              );
              results.push(JSON.parse(content));
            }
          }

          if (format === 'html' && (await fs.pathExists(reportsDir))) {
            const htmlFiles = await fs.readdir(reportsDir);
            results = htmlFiles
              .filter((f) => f.endsWith('.html'))
              .slice(0, limit);
          }

          return {
            format,
            results,
            total: results.length,
            reportsDir,
            resultsDir,
          };
        },
        {
          request: { type: 'get_test_results', format, limit },
          correlationId,
          model: 'playwright-results-reader',
        }
      );

      if (result.success) {
        this.logger.info('Test results retrieved successfully', {
          correlationId,
          total: result.data.total,
          format,
        });

        return {
          content: [
            { type: 'text', text: JSON.stringify(result.data, null, 2) },
          ],
          isError: false,
        };
      } else {
        this.logger.error('Failed to get test results', {
          correlationId,
          error: result.error?.message,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Error getting test results: ${result.error?.message}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      this.logger.error('Error in getTestResults', {
        correlationId,
        error: error.message,
      });
      throw new Error(`Error getting test results: ${error.message}`);
    }
  }

  async debugTest({ testFile, browser }) {
    const correlationId = `debug-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info('Debugging Playwright test', {
      correlationId,
      testFile,
      browser,
    });

    try {
      const result = await this.errorHandler.executeAPIRequest(
        async () => {
          const options = [testFile];
          if (browser) options.push(`--browser=${browser}`);

          // Run test in debug mode
          const debugCommand = `npx playwright test --debug ${options.join(' ')}`;
          const output = execSync(debugCommand, {
            encoding: 'utf8',
            cwd: process.cwd(),
            timeout: config.limits.maxTestDuration,
          });

          // Generate trace (optional, may not always be available)
          try {
            const traceCommand = `npx playwright show-trace`;
            execSync(traceCommand, {
              encoding: 'utf8',
              cwd: process.cwd(),
              timeout: 10000,
            });
          } catch (traceError) {
            this.logger.warn('Trace viewer could not be opened', {
              correlationId,
              error: traceError.message,
            });
          }

          return {
            message: `Debug session completed for: ${testFile}`,
            output,
          };
        },
        {
          request: { type: 'debug_test', testFile, browser },
          correlationId,
          model: 'playwright-debugger',
        }
      );

      if (result.success) {
        this.logger.info('Debug session completed successfully', {
          correlationId,
          testFile,
        });

        return {
          content: [
            {
              type: 'text',
              text: `${result.data.message}\n\nOutput:\n${result.data.output}\n\nTrace viewer opened for debugging.`,
            },
          ],
          isError: false,
        };
      } else {
        this.logger.error('Debug session failed', {
          correlationId,
          error: result.error?.message,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Error debugging test: ${result.error?.message}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      this.logger.error('Error in debugTest', {
        correlationId,
        error: error.message,
      });
      throw new Error(`Error debugging test: ${error.message}`);
    }
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

  async performHealthCheck() {
    const timestamp = new Date().toISOString();
    const checks = {};

    // Playwright installation check
    try {
      execSync('npx playwright --version', {
        encoding: 'utf8',
        timeout: 5000,
        cwd: process.cwd(),
      });
      checks.playwright = {
        status: 'healthy',
        version: 'installed',
      };
    } catch (error) {
      checks.playwright = { status: 'error', error: error.message };
    }

    // Circuit breaker check
    const circuitBreakerStats =
      this.errorHandler.getHealthStats().circuitBreaker;
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

    // Test directory check
    try {
      const testDir = path.join(process.cwd(), 'tests');
      const exists = await fs.pathExists(testDir);
      checks.testDirectory = {
        status: exists ? 'healthy' : 'warning',
        path: testDir,
        exists,
      };
    } catch (error) {
      checks.testDirectory = { status: 'error', error: error.message };
    }

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

    // Add detailed system information
    try {
      health.system = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      };
    } catch (error) {
      health.system = { error: error.message };
    }

    // Add configuration summary
    health.configuration = {
      environment: config.environment,
      playwright: {
        defaultBrowser: config.playwright.defaultBrowser,
        defaultHeadless: config.playwright.defaultHeadless,
        workers: config.playwright.workers,
      },
      limits: config.limits,
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

      this.logger.info('Playwright MCP server started successfully', {
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
      this.logger.error('Failed to start Playwright MCP server', {
        error: error.message,
      });
      throw error;
    }
  }

  async shutdown() {
    this.logger.info('Shutting down Playwright MCP server...');

    // Stop health check server
    if (this.healthServer) {
      this.healthServer.close();
    }

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Reset error handler
    this.errorHandler.reset();

    this.logger.info('Playwright MCP server shut down successfully');
    process.exit(0);
  }
}

const server = new PlaywrightMCPServer();
server.run().catch(console.error);
