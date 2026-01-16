#!/usr/bin/env node

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const {
  StdioServerTransport,
} = require('@modelcontextprotocol/sdk/server/stdio.js');
const { Octokit } = require('octokit');
const z = require('zod');
const { kiloCodeLogger } = require('@kilo-code/error-handling/logger');
const {
  ExponentialBackoffRetry,
  CircuitBreaker,
  circuitBreakerRegistry,
  retryConfigs,
} = require('@kilo-code/error-handling');

class GitHubMCPServer {
  constructor() {
    // Load configuration
    this.config = loadConfig();

    this.logger = kiloCodeLogger;
    this.correlationId = this.generateCorrelationId();

    this.logger.logAPIRequest(
      this.logger.createContext({
        correlationId: this.correlationId,
        model: 'github-mcp-server',
      }),
      {
        method: 'INIT',
        url: 'github-mcp-server',
        body: { version: this.config.serverVersion },
      }
    );

    this.server = new McpServer({
      name: this.config.serverName,
      version: this.config.serverVersion,
    });

    // Initialize error handling components
    this.retryHandler = new ExponentialBackoffRetry({
      maxAttempts: this.config.maxRetries,
      baseDelay: this.config.retryDelay,
      maxDelay: 10000,
    });

    this.circuitBreaker = this.config.circuitBreakerEnabled
      ? circuitBreakerRegistry.createBreaker('github-api', {
          failureThreshold: this.config.circuitBreakerFailureThreshold,
          recoveryTimeout: this.config.circuitBreakerRecoveryTimeout,
        })
      : null;

    this.octokit = new Octokit({
      auth: this.config.githubToken,
      baseUrl: this.config.githubApiUrl,
      request: {
        timeout: this.config.requestTimeout,
      },
    });

    this.setupToolHandlers();

    this.logger.logAPIResponse(
      this.logger.createContext({
        correlationId: this.correlationId,
        model: 'github-mcp-server',
      }),
      { status: 200, body: { message: 'GitHub MCP server initialized' } },
      {
        requestStartTime: Date.now(),
        requestEndTime: Date.now(),
        status: 'success',
      }
    );
  }

  generateCorrelationId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  /**
   * Execute GitHub API call with retry and circuit breaker protection
   */
  async executeGitHubAPICall(apiCall, context, operation) {
    const logContext = this.logger.createContext({
      correlationId: context.requestId,
      model: 'github-api',
      requestId: context.requestId,
    });

    if (this.circuitBreaker) {
      return await this.circuitBreaker.execute(async () => {
        return await this.retryHandler.execute(apiCall, logContext, operation);
      }, logContext);
    } else {
      return await this.retryHandler.execute(apiCall, logContext, operation);
    }
  }

  setupToolHandlers() {
    // Register get_issues tool
    this.server.registerTool(
      'get_issues',
      {
        title: 'Get Issues',
        description: 'Get issues from a GitHub repository',
        inputSchema: {
          owner: z.string().describe('Repository owner'),
          repo: z.string().describe('Repository name'),
          state: z
            .enum(['open', 'closed', 'all'])
            .default('open')
            .describe('Issue state'),
          limit: z
            .number()
            .min(1)
            .max(this.config.maxIssuesLimit)
            .default(this.config.defaultIssuesLimit)
            .describe('Maximum number of issues to return'),
        },
        outputSchema: {
          issues: z.array(
            z.object({
              number: z.number(),
              title: z.string(),
              state: z.string(),
              created_at: z.string(),
              updated_at: z.string(),
              html_url: z.string(),
            })
          ),
        },
      },
      async (args) => await this.getIssues(args)
    );

    // Register get_pull_requests tool
    this.server.registerTool(
      'get_pull_requests',
      {
        title: 'Get Pull Requests',
        description: 'Get pull requests from a GitHub repository',
        inputSchema: {
          owner: z.string().describe('Repository owner'),
          repo: z.string().describe('Repository name'),
          state: z
            .enum(['open', 'closed', 'all'])
            .default('open')
            .describe('Pull request state'),
          limit: z
            .number()
            .min(1)
            .max(this.config.maxPullRequestsLimit)
            .default(this.config.defaultPullRequestsLimit)
            .describe('Maximum number of pull requests to return'),
        },
        outputSchema: {
          pull_requests: z.array(
            z.object({
              number: z.number(),
              title: z.string(),
              state: z.string(),
              created_at: z.string(),
              updated_at: z.string(),
              html_url: z.string(),
              user: z.object({
                login: z.string(),
                html_url: z.string(),
              }),
            })
          ),
        },
      },
      async (args) => await this.getPullRequests(args)
    );

    // Register health_check tool
    this.server.registerTool(
      'health_check',
      {
        title: 'Health Check',
        description: 'Check the health status of the GitHub MCP server',
        inputSchema: {
          includeCircuitBreaker: z
            .boolean()
            .default(true)
            .describe('Include circuit breaker status'),
          includeConfig: z
            .boolean()
            .default(false)
            .describe('Include configuration status (without sensitive data)'),
        },
        outputSchema: {
          status: z.enum(['healthy', 'degraded', 'unhealthy']),
          timestamp: z.string(),
          version: z.string(),
          uptime: z.number(),
          circuitBreaker: z
            .object({
              state: z.string(),
              failureCount: z.number(),
              lastFailureTime: z.string().optional(),
            })
            .optional(),
          config: z
            .object({
              serverName: z.string(),
              serverVersion: z.string(),
              githubApiUrl: z.string(),
              requestTimeout: z.number(),
              maxRetries: z.number(),
              circuitBreakerEnabled: z.boolean(),
            })
            .optional(),
        },
      },
      async (args) => await this.healthCheck(args)
    );
  }

  async getIssues({ owner, repo, state = 'open', limit = 10 }) {
    const startTime = Date.now();
    const requestId = this.generateCorrelationId();

    try {
      this.logger.logAPIRequest(
        this.logger.createContext({
          correlationId: requestId,
          model: 'github-api',
          requestId,
        }),
        {
          method: 'GET',
          url: `https://api.github.com/repos/${owner}/${repo}/issues`,
          body: { state, per_page: limit },
        }
      );

      const response = await this.executeGitHubAPICall(
        () =>
          this.octokit.rest.issues.listForRepo({
            owner,
            repo,
            state,
            per_page: limit,
          }),
        { requestId },
        'list-issues'
      );

      const issues = response.data.map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        html_url: issue.html_url,
      }));

      this.logger.logAPIResponse(
        this.logger.createContext({
          correlationId: requestId,
          model: 'github-api',
          requestId,
        }),
        { status: 200, body: { issuesCount: issues.length } },
        {
          requestStartTime: startTime,
          requestEndTime: Date.now(),
          status: 'success',
        }
      );

      return {
        content: [{ type: 'text', text: JSON.stringify({ issues }, null, 2) }],
        structuredContent: { issues },
      };
    } catch (error) {
      this.logger.logAPIError(
        this.logger.createContext({
          correlationId: requestId,
          model: 'github-api',
          requestId,
        }),
        error,
        {
          method: 'GET',
          url: `https://api.github.com/repos/${owner}/${repo}/issues`,
          body: { state, per_page: limit },
        },
        {
          requestStartTime: startTime,
          status: 'error',
        }
      );
      throw new Error(`Error fetching issues: ${error.message}`);
    }
  }

  async getPullRequests({ owner, repo, state = 'open', limit = 10 }) {
    const startTime = Date.now();
    const requestId = this.generateCorrelationId();

    try {
      this.logger.logAPIRequest(
        this.logger.createContext({
          correlationId: requestId,
          model: 'github-api',
          requestId,
        }),
        {
          method: 'GET',
          url: `https://api.github.com/repos/${owner}/${repo}/pulls`,
          body: { state, per_page: limit },
        }
      );

      const response = await this.executeGitHubAPICall(
        () =>
          this.octokit.rest.pulls.list({
            owner,
            repo,
            state,
            per_page: limit,
          }),
        { requestId },
        'list-pull-requests'
      );

      const pull_requests = response.data.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        html_url: pr.html_url,
        user: {
          login: pr.user.login,
          html_url: pr.user.html_url,
        },
      }));

      this.logger.logAPIResponse(
        this.logger.createContext({
          correlationId: requestId,
          model: 'github-api',
          requestId,
        }),
        { status: 200, body: { pullRequestsCount: pull_requests.length } },
        {
          requestStartTime: startTime,
          requestEndTime: Date.now(),
          status: 'success',
        }
      );

      return {
        content: [
          { type: 'text', text: JSON.stringify({ pull_requests }, null, 2) },
        ],
        structuredContent: { pull_requests },
      };
    } catch (error) {
      this.logger.logAPIError(
        this.logger.createContext({
          correlationId: requestId,
          model: 'github-api',
          requestId,
        }),
        error,
        {
          method: 'GET',
          url: `https://api.github.com/repos/${owner}/${repo}/pulls`,
          body: { state, per_page: limit },
        },
        {
          requestStartTime: startTime,
          status: 'error',
        }
      );
      throw new Error(`Error fetching pull requests: ${error.message}`);
    }
  }

  async healthCheck({ includeCircuitBreaker = true, includeConfig = false }) {
    const startTime = Date.now();
    const requestId = this.generateCorrelationId();

    try {
      this.logger.logAPIRequest(
        this.logger.createContext({
          correlationId: requestId,
          model: 'health-check',
          requestId,
        }),
        {
          method: 'HEALTH',
          url: 'github-mcp-server/health',
          body: { includeCircuitBreaker, includeConfig },
        }
      );

      const uptime = process.uptime();
      let status = 'healthy';
      let circuitBreakerInfo = undefined;
      let configInfo = undefined;

      // Check circuit breaker status
      if (includeCircuitBreaker && this.circuitBreaker) {
        const cbStats = this.circuitBreaker.getStats();
        circuitBreakerInfo = {
          state: cbStats.state,
          failureCount: cbStats.failureCount,
          lastFailureTime: cbStats.lastFailureTime
            ? new Date(cbStats.lastFailureTime).toISOString()
            : undefined,
        };

        // Degrade status if circuit breaker is open
        if (cbStats.state === 'open') {
          status = 'degraded';
        }
      }

      // Include config info (without sensitive data)
      if (includeConfig) {
        configInfo = {
          serverName: this.config.serverName,
          serverVersion: this.config.serverVersion,
          githubApiUrl: this.config.githubApiUrl,
          requestTimeout: this.config.requestTimeout,
          maxRetries: this.config.maxRetries,
          circuitBreakerEnabled: this.config.circuitBreakerEnabled,
        };
      }

      // Test GitHub API connectivity (lightweight call)
      try {
        await this.executeGitHubAPICall(
          () => this.octokit.rest.meta.get(),
          { requestId },
          'health-check-api'
        );
      } catch (error) {
        status = 'degraded';
        console.error('GitHub API health check failed:', error.message);
      }

      const result = {
        status,
        timestamp: new Date().toISOString(),
        version: this.config.serverVersion,
        uptime: Math.floor(uptime),
        circuitBreaker: circuitBreakerInfo,
        config: configInfo,
      };

      this.logger.logAPIResponse(
        this.logger.createContext({
          correlationId: requestId,
          model: 'health-check',
          requestId,
        }),
        { status: 200, body: { status } },
        {
          requestStartTime: startTime,
          requestEndTime: Date.now(),
          status: 'success',
        }
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      this.logger.logAPIError(
        this.logger.createContext({
          correlationId: requestId,
          model: 'health-check',
          requestId,
        }),
        error,
        {
          method: 'HEALTH',
          url: 'github-mcp-server/health',
          body: { includeCircuitBreaker, includeConfig },
        },
        {
          requestStartTime: startTime,
          status: 'error',
        }
      );
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  async run() {
    try {
      console.error(
        `Starting GitHub MCP server with correlation ID: ${this.correlationId}`
      );

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.logger.logAPIResponse(
        this.logger.createContext({
          correlationId: this.correlationId,
          model: 'github-mcp-server',
        }),
        { status: 200, body: { message: 'Server started successfully' } },
        {
          requestStartTime: Date.now(),
          requestEndTime: Date.now(),
          status: 'success',
        }
      );

      console.error('GitHub MCP server running on stdio');
    } catch (error) {
      this.logger.logAPIError(
        this.logger.createContext({
          correlationId: this.correlationId,
          model: 'github-mcp-server',
        }),
        error,
        {
          method: 'START',
          url: 'github-mcp-server',
        },
        {
          requestStartTime: Date.now(),
          status: 'error',
        }
      );
      throw error;
    }
  }
}

const server = new GitHubMCPServer();
server.run().catch(console.error);