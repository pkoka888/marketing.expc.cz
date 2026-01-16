#!/usr/bin/env node

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const {
  StdioServerTransport,
} = require('@modelcontextprotocol/sdk/server/stdio.js');
require('dotenv').config();
const z = require('zod');

const config = require('./config');
const logger = require('./logger');
const { databaseManager, DatabaseError } = require('./database');
const healthServer = require('./health-server');

class PostgreSQLMCPServer {
  constructor() {
    this.server = new McpServer({
      name: config.server.name,
      version: config.server.version,
    });

    this.setupToolHandlers();
    this.setupGracefulShutdown();
  }

  setupToolHandlers() {
    // Register connect tool
    this.server.registerTool(
      'connect',
      {
        title: 'Connect to Database',
        description: 'Connect to PostgreSQL database',
        inputSchema: {
          host: z
            .string()
            .default(process.env.DB_HOST || 'localhost')
            .describe('Database host'),
          port: z
            .number()
            .min(1)
            .max(65535)
            .default(process.env.DB_PORT || 5432)
            .describe('Database port'),
          database: z
            .string()
            .default(process.env.DB_NAME || 'marketingportal')
            .describe('Database name'),
          user: z
            .string()
            .default(process.env.DB_USER || 'postgres')
            .describe('Database user'),
          password: z.string().optional().describe('Database password'),
          ssl: z.boolean().default(false).describe('Use SSL connection'),
        },
        outputSchema: {
          message: z.string(),
        },
      },
      async (args) => await this.connect(args)
    );

    // Register execute_query tool
    this.server.registerTool(
      'execute_query',
      {
        title: 'Execute Query',
        description: 'Execute SQL query with optional parameters',
        inputSchema: {
          query: z.string().describe('SQL query to execute'),
          params: z.array(z.any()).default([]).describe('Query parameters'),
          timeout: z
            .number()
            .min(1000)
            .max(300000)
            .default(30000)
            .describe('Query timeout in milliseconds'),
        },
        outputSchema: {
          query: z.string(),
          rows: z.number(),
          fields: z.array(z.string()),
          duration: z.string(),
          command: z.string().optional(),
          rowCount: z.number().optional(),
        },
      },
      async (args) => await this.executeQuery(args)
    );

    // Register get_tables tool
    this.server.registerTool(
      'get_tables',
      {
        title: 'Get Tables',
        description: 'Get list of tables in the database',
        inputSchema: {
          schema: z.string().default('public').describe('Schema name'),
        },
        outputSchema: {
          schema: z.string(),
          tables: z.array(
            z.object({
              table_name: z.string(),
              table_type: z.string(),
              table_schema: z.string(),
            })
          ),
          total: z.number(),
        },
      },
      async (args) => await this.getTables(args)
    );

    // Register get_table_schema tool
    this.server.registerTool(
      'get_table_schema',
      {
        title: 'Get Table Schema',
        description: 'Get schema information for a specific table',
        inputSchema: {
          table: z.string().describe('Table name'),
          schema: z.string().default('public').describe('Schema name'),
        },
        outputSchema: {
          table: z.string(),
          schema: z.string(),
          columns: z.array(
            z.object({
              column_name: z.string(),
              data_type: z.string(),
              is_nullable: z.string(),
              column_default: z.any().optional(),
              character_maximum_length: z.number().optional(),
              numeric_precision: z.number().optional(),
              numeric_scale: z.number().optional(),
            })
          ),
          total: z.number(),
        },
      },
      async (args) => await this.getTableSchema(args)
    );

    // Register get_database_info tool
    this.server.registerTool(
      'get_database_info',
      {
        title: 'Get Database Info',
        description: 'Get database information and statistics',
        inputSchema: {
          includeSize: z
            .boolean()
            .default(true)
            .describe('Include database size information'),
          includeConnections: z
            .boolean()
            .default(true)
            .describe('Include connection information'),
        },
        outputSchema: {
          timestamp: z.string(),
          database: z.record(z.any()),
          performance: z.record(z.any()).optional(),
          connections: z.record(z.any()).optional(),
        },
      },
      async (args) => await this.getDatabaseInfo(args)
    );

    // Register monitor_performance tool
    this.server.registerTool(
      'monitor_performance',
      {
        title: 'Monitor Performance',
        description: 'Monitor database performance metrics',
        inputSchema: {
          duration: z
            .number()
            .min(10)
            .max(3600)
            .default(60)
            .describe('Monitoring duration in seconds'),
        },
        outputSchema: {
          duration: z.number(),
          metrics: z.array(z.record(z.any())),
          summary: z.object({
            totalMetrics: z.number(),
            timeRange: z.object({
              start: z.string().optional(),
              end: z.string().optional(),
            }),
          }),
        },
      },
      async (args) => await this.monitorPerformance(args)
    );

    // Register backup_database tool
    this.server.registerTool(
      'backup_database',
      {
        title: 'Backup Database',
        description: 'Create database backup',
        inputSchema: {
          format: z
            .enum(['custom', 'tar', 'plain'])
            .default('custom')
            .describe('Backup format'),
          includeData: z
            .boolean()
            .default(true)
            .describe('Include data in backup'),
          includeSchema: z
            .boolean()
            .default(true)
            .describe('Include schema in backup'),
        },
        outputSchema: {
          message: z.string(),
        },
      },
      async (args) => await this.backupDatabase(args)
    );

    // Register restore_database tool
    this.server.registerTool(
      'restore_database',
      {
        title: 'Restore Database',
        description: 'Restore database from backup',
        inputSchema: {
          backupFile: z.string().describe('Path to backup file'),
          dropExisting: z
            .boolean()
            .default(false)
            .describe('Drop existing objects before restore'),
        },
        outputSchema: {
          message: z.string(),
        },
      },
      async (args) => await this.restoreDatabase(args)
    );
  }

  async connect({ host, port, database, user, password, ssl }) {
    const startTime = Date.now();

    try {
      logger.logMCPOperation(
        'connect',
        { host, port, database, user, ssl },
        {},
        0
      );

      const connectionInfo = await databaseManager.connect({
        host,
        port,
        database,
        user,
        password,
        ssl,
      });

      const duration = Date.now() - startTime;
      const message = `Connected to PostgreSQL at ${connectionInfo.host}:${connectionInfo.port}, database: ${connectionInfo.database}`;

      logger.logMCPOperation(
        'connect',
        { host, port, database, user, ssl },
        { message },
        duration
      );

      return {
        content: [{ type: 'text', text: message }],
        structuredContent: { message, connectionInfo },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logMCPOperation(
        'connect',
        { host, port, database, user, ssl },
        {},
        duration,
        error
      );

      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Error connecting to PostgreSQL: ${error.message}`,
        'CONNECTION_FAILED',
        error
      );
    }
  }

  async executeQuery({ query, params, timeout }) {
    const startTime = Date.now();

    try {
      logger.logMCPOperation(
        'execute_query',
        { query, paramsCount: params?.length, timeout },
        {},
        0
      );

      const result = await databaseManager.query(query, params || [], {
        timeout,
      });

      const duration = Date.now() - startTime;
      const output = {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        rows: result.rows.length,
        fields: result.fields.map((f) => f.name),
        duration: `${duration}ms`,
        command: result.command,
        rowCount: result.rowCount,
      };

      logger.logMCPOperation(
        'execute_query',
        { query, paramsCount: params?.length, timeout },
        output,
        duration
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logMCPOperation(
        'execute_query',
        { query, paramsCount: params?.length, timeout },
        {},
        duration,
        error
      );

      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Error executing query: ${error.message}`,
        'QUERY_FAILED',
        error
      );
    }
  }

  async getTables({ schema }) {
    const startTime = Date.now();

    try {
      logger.logMCPOperation('get_tables', { schema }, {}, 0);

      const query = `
        SELECT table_name, table_type, table_schema
        FROM information_schema.tables
        WHERE table_schema = $1
        ORDER BY table_name
      `;

      const result = await databaseManager.query(query, [schema || 'public']);

      const duration = Date.now() - startTime;
      const output = {
        schema: schema || 'public',
        tables: result.rows,
        total: result.rows.length,
      };

      logger.logMCPOperation('get_tables', { schema }, output, duration);

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logMCPOperation('get_tables', { schema }, {}, duration, error);

      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Error getting tables: ${error.message}`,
        'QUERY_FAILED',
        error
      );
    }
  }

  async getTableSchema({ table, schema }) {
    const startTime = Date.now();

    try {
      logger.logMCPOperation('get_table_schema', { table, schema }, {}, 0);

      const query = `
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = $2
        ORDER BY ordinal_position
      `;

      const result = await databaseManager.query(query, [
        table,
        schema || 'public',
      ]);

      const duration = Date.now() - startTime;
      const output = {
        table: table,
        schema: schema || 'public',
        columns: result.rows,
        total: result.rows.length,
      };

      logger.logMCPOperation(
        'get_table_schema',
        { table, schema },
        output,
        duration
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logMCPOperation(
        'get_table_schema',
        { table, schema },
        {},
        duration,
        error
      );

      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Error getting table schema: ${error.message}`,
        'QUERY_FAILED',
        error
      );
    }
  }

  async getDatabaseInfo({ includeSize, includeConnections }) {
    const startTime = Date.now();

    try {
      logger.logMCPOperation(
        'get_database_info',
        { includeSize, includeConnections },
        {},
        0
      );

      const info = {
        timestamp: new Date().toISOString(),
        database: {},
        performance: {},
      };

      // Database basic info
      const dbInfoQuery = `
        SELECT
          datname as name,
          pg_size_pretty(pg_database_size(datname)) as size,
          datistemplate as is_template,
          datallowconn as allow_connections
        FROM pg_database
        WHERE datname = current_database()
      `;

      const dbResult = await databaseManager.query(dbInfoQuery);
      info.database = dbResult.rows[0];

      // Connection info
      if (includeConnections) {
        const connQuery = `
          SELECT
            count(*) as total_connections,
            count(*) filter (where state = 'active') as active_connections,
            count(*) filter (where state = 'idle') as idle_connections,
            count(*) filter (where state = 'idle in transaction') as idle_in_transaction
          FROM pg_stat_activity
          WHERE datname = current_database()
        `;

        const connResult = await databaseManager.query(connQuery);
        info.connections = connResult.rows[0];
      }

      // Performance stats
      const perfQuery = `
        SELECT
          sum(seq_scan) as sequential_scans,
          sum(seq_tup_read) as tuples_read,
          sum(idx_scan) as index_scans,
          sum(idx_tup_fetch) as tuples_fetched,
          sum(n_tup_ins) as inserts,
          sum(n_tup_upd) as updates,
          sum(n_tup_del) as deletes
        FROM pg_stat_user_tables
      `;

      const perfResult = await databaseManager.query(perfQuery);
      info.performance = perfResult.rows[0];

      const duration = Date.now() - startTime;
      logger.logMCPOperation(
        'get_database_info',
        { includeSize, includeConnections },
        info,
        duration
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
        structuredContent: info,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logMCPOperation(
        'get_database_info',
        { includeSize, includeConnections },
        {},
        duration,
        error
      );

      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Error getting database info: ${error.message}`,
        'QUERY_FAILED',
        error
      );
    }
  }

  async monitorPerformance({ duration }) {
    const startTime = Date.now();

    try {
      logger.logMCPOperation('monitor_performance', { duration }, {}, 0);

      const endTime = startTime + (duration || 60) * 1000;
      const metrics = [];

      const monitorInterval = setInterval(async () => {
        try {
          const metric = {
            timestamp: new Date().toISOString(),
          };

          // Query performance
          const perfQuery = `
            SELECT
              query,
              calls,
              total_time,
              mean_time,
              rows
            FROM pg_stat_statements
            ORDER BY total_time DESC
            LIMIT 5
          `;

          const perfResult = await databaseManager.query(perfQuery);
          metric.topQueries = perfResult.rows;

          // Connection stats
          const connQuery = `
            SELECT
              count(*) as total,
              count(*) filter (where state = 'active') as active
            FROM pg_stat_activity
          `;

          const connResult = await databaseManager.query(connQuery);
          metric.connections = connResult.rows[0];

          // Database size
          const sizeQuery = `
            SELECT pg_size_pretty(pg_database_size(current_database())) as size
          `;

          const sizeResult = await databaseManager.query(sizeQuery);
          metric.databaseSize = sizeResult.rows[0].size;

          metrics.push(metric);
        } catch (error) {
          logger.logDatabaseError('performance_monitoring', error);
        }
      }, 5000); // Every 5 seconds

      // Wait for monitoring duration
      await new Promise((resolve) =>
        setTimeout(resolve, (duration || 60) * 1000)
      );

      clearInterval(monitorInterval);

      const monitoringDuration = (Date.now() - startTime) / 1000;
      const output = {
        duration: monitoringDuration,
        metrics: metrics,
        summary: {
          totalMetrics: metrics.length,
          timeRange: {
            start: metrics[0]?.timestamp,
            end: metrics[metrics.length - 1]?.timestamp,
          },
        },
      };

      logger.logMCPOperation(
        'monitor_performance',
        { duration },
        output,
        monitoringDuration * 1000
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      const monitoringDuration = (Date.now() - startTime) / 1000;
      logger.logMCPOperation(
        'monitor_performance',
        { duration },
        {},
        monitoringDuration * 1000,
        error
      );

      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Error monitoring performance: ${error.message}`,
        'MONITORING_FAILED',
        error
      );
    }
  }

  async backupDatabase({ format, includeData, includeSchema }) {
    const startTime = Date.now();

    try {
      logger.logMCPOperation(
        'backup_database',
        { format, includeData, includeSchema },
        {},
        0
      );

      // Note: This is a simplified backup implementation
      // In production, you would use pg_dump or similar tools
      const backupInfo = {
        timestamp: new Date().toISOString(),
        format: format || 'custom',
        includeData: includeData !== false,
        includeSchema: includeSchema !== false,
        database: await this.getCurrentDatabaseName(),
        tables: [],
      };

      // Get table list for backup
      const tablesResult = await this.getTables({ schema: 'public' });
      if (tablesResult.structuredContent) {
        backupInfo.tables = tablesResult.structuredContent.tables;
      }

      const duration = Date.now() - startTime;
      const message = `Database backup prepared: ${JSON.stringify(backupInfo, null, 2)}\n\nNote: For actual backup, use pg_dump command: pg_dump -h ${config.database.host} -U ${config.database.user} -d ${config.database.name} -f backup.sql`;

      logger.logMCPOperation(
        'backup_database',
        { format, includeData, includeSchema },
        { message },
        duration
      );

      return {
        content: [{ type: 'text', text: message }],
        structuredContent: { message },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logMCPOperation(
        'backup_database',
        { format, includeData, includeSchema },
        {},
        duration,
        error
      );

      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Error creating backup: ${error.message}`,
        'BACKUP_FAILED',
        error
      );
    }
  }

  async restoreDatabase({ backupFile, dropExisting }) {
    const startTime = Date.now();

    try {
      logger.logMCPOperation(
        'restore_database',
        { backupFile, dropExisting },
        {},
        0
      );

      const restoreInfo = {
        timestamp: new Date().toISOString(),
        backupFile: backupFile,
        dropExisting: dropExisting || false,
        database: await this.getCurrentDatabaseName(),
      };

      const duration = Date.now() - startTime;
      const message = `Database restore prepared: ${JSON.stringify(restoreInfo, null, 2)}\n\nNote: For actual restore, use psql command: psql -h ${config.database.host} -U ${config.database.user} -d ${config.database.name} -f ${backupFile}`;

      logger.logMCPOperation(
        'restore_database',
        { backupFile, dropExisting },
        { message },
        duration
      );

      return {
        content: [{ type: 'text', text: message }],
        structuredContent: { message },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logMCPOperation(
        'restore_database',
        { backupFile, dropExisting },
        {},
        duration,
        error
      );

      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Error preparing restore: ${error.message}`,
        'RESTORE_FAILED',
        error
      );
    }
  }

  async getCurrentDatabaseName() {
    try {
      const result = await databaseManager.query('SELECT current_database()');
      return result.rows[0].current_database;
    } catch (error) {
      logger.logDatabaseError('get_current_database', error);
      return 'unknown';
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.logServerStop({ signal, reason: 'graceful_shutdown' });

      try {
        // Stop health server
        await healthServer.stop();

        // Close database connections
        await databaseManager.gracefulShutdown();

        // Close MCP server
        await this.server.close();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.logServerError(error, { context: 'shutdown' });
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.logServerError(error, { context: 'uncaught_exception' });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.logServerError(new Error(`Unhandled Rejection: ${reason}`), {
        context: 'unhandled_rejection',
        promise: promise.toString(),
      });
      shutdown('unhandledRejection');
    });
  }

  async run() {
    try {
      logger.logServerStart({
        version: config.server.version,
        nodeVersion: process.version,
        platform: process.platform,
      });

      // Start health check server
      if (config.server.enableHealthChecks) {
        await healthServer.start();
      }

      // Auto-connect to database
      logger.info('Auto-connecting to database...');
      await databaseManager.connect();

      // Connect MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      logger.info('PostgreSQL MCP server running on stdio', {
        healthCheckPort: config.server.healthCheckPort,
      });
    } catch (error) {
      logger.logServerError(error, { context: 'server_start' });
      throw error;
    }
  }
}

const server = new PostgreSQLMCPServer();
server.run().catch(console.error);
