/**
 * Comprehensive Logging Utilities for Kilo Code API Error Handling
 *
 * Provides structured logging with correlation IDs, performance metrics,
 * and error tracking for API interactions.
 */

// Simple UUID generation for browser compatibility
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface LogContext {
  correlationId: string;
  timestamp: string;
  model?: string;
  provider?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface APIMetrics {
  requestStartTime: number;
  requestEndTime?: number;
  duration?: number;
  tokensUsed?: number;
  tokensInput?: number;
  tokensOutput?: number;
  cost?: number;
  status: 'success' | 'error' | 'timeout' | 'retry' | 'pending';
  retryCount?: number;
}

export interface APIRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export interface APIResponse {
  status: number;
  headers?: Record<string, string>;
  body?: any;
  size?: number;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: LogContext;
  metrics?: APIMetrics;
  request?: APIRequest;
  response?: APIResponse;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
}

export class KiloCodeLogger {
  private static instance: KiloCodeLogger;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;
  private logFilePath = './logs/kilo-code-api.log';

  private constructor() {
    // Ensure logs directory exists
    this.ensureLogsDirectory();
  }

  static getInstance(): KiloCodeLogger {
    if (!KiloCodeLogger.instance) {
      KiloCodeLogger.instance = new KiloCodeLogger();
    }
    return KiloCodeLogger.instance;
  }

  private ensureLogsDirectory(): void {
    // In a real implementation, this would create the directory
    // For now, we'll use console logging
  }

  createContext(overrides: Partial<LogContext> = {}): LogContext {
    return {
      correlationId: overrides.correlationId || generateUUID(),
      timestamp: overrides.timestamp || new Date().toISOString(),
      model: overrides.model,
      provider: overrides.provider || 'kilocode',
      userId: overrides.userId,
      sessionId: overrides.sessionId,
      requestId: overrides.requestId,
    };
  }

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    context: LogContext,
    additionalData: Partial<LogEntry> = {}
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      context,
      ...additionalData,
    };

    // Add to buffer
    this.logBuffer.push(entry);

    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    return entry;
  }

  private log(entry: LogEntry): void {
    const logString = JSON.stringify(entry, null, 2);

    // Console logging with color coding
    switch (entry.level) {
      case 'debug':
        console.debug(`🐛 ${entry.message}`, entry);
        break;
      case 'info':
        console.info(`ℹ️ ${entry.message}`, entry);
        break;
      case 'warn':
        console.warn(`⚠️ ${entry.message}`, entry);
        break;
      case 'error':
        console.error(`❌ ${entry.message}`, entry);
        break;
    }

    // In production, this would write to file/database
    // this.writeToFile(logString);
  }

  logAPIRequest(
    context: LogContext,
    request: APIRequest,
    metrics: Partial<APIMetrics> = {}
  ): void {
    const entry = this.createLogEntry(
      'info',
      `API Request: ${request.method} ${request.url}`,
      context,
      {
        request,
        metrics: {
          ...metrics,
          requestStartTime: Date.now(),
          status: 'pending' as const,
        },
      }
    );
    this.log(entry);
  }

  logAPIResponse(
    context: LogContext,
    response: APIResponse,
    metrics: APIMetrics
  ): void {
    const duration = metrics.requestEndTime! - metrics.requestStartTime;
    const entry = this.createLogEntry(
      'info',
      `API Response: ${response.status} (${duration}ms)`,
      context,
      {
        response,
        metrics: {
          ...metrics,
          duration,
        },
      }
    );
    this.log(entry);
  }

  logAPIError(
    context: LogContext,
    error: Error,
    request?: APIRequest,
    metrics: Partial<APIMetrics> = {}
  ): void {
    const entry = this.createLogEntry(
      'error',
      `API Error: ${error.message}`,
      context,
      {
        request,
        metrics: {
          ...metrics,
          status: 'error',
          requestEndTime: Date.now(),
        } as APIMetrics,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        },
      }
    );
    this.log(entry);
  }

  logRetryAttempt(
    context: LogContext,
    attemptNumber: number,
    delay: number,
    error?: Error
  ): void {
    const entry = this.createLogEntry(
      'warn',
      `Retry attempt ${attemptNumber} after ${delay}ms`,
      context,
      {
        metadata: { attemptNumber, delay },
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : undefined,
      }
    );
    this.log(entry);
  }

  logCircuitBreakerState(
    context: LogContext,
    state: 'closed' | 'open' | 'half-open',
    failureCount: number,
    nextAttemptTime?: number
  ): void {
    const entry = this.createLogEntry(
      'warn',
      `Circuit breaker ${state} (failures: ${failureCount})`,
      context,
      {
        metadata: {
          circuitBreakerState: state,
          failureCount,
          nextAttemptTime,
        },
      }
    );
    this.log(entry);
  }

  logHistoryTruncation(
    context: LogContext,
    originalLength: number,
    truncatedLength: number,
    tokensRemoved: number
  ): void {
    const entry = this.createLogEntry(
      'info',
      `History truncated: ${originalLength} → ${truncatedLength} messages (${tokensRemoved} tokens removed)`,
      context,
      {
        metadata: {
          originalLength,
          truncatedLength,
          tokensRemoved,
        },
      }
    );
    this.log(entry);
  }

  logTimeout(
    context: LogContext,
    timeoutMs: number,
    request?: APIRequest
  ): void {
    const entry = this.createLogEntry(
      'warn',
      `Request timeout after ${timeoutMs}ms`,
      context,
      {
        request,
        metrics: {
          requestStartTime: Date.now() - timeoutMs,
          requestEndTime: Date.now(),
          duration: timeoutMs,
          status: 'timeout',
        } as APIMetrics,
      }
    );
    this.log(entry);
  }

  // Standard logging methods compatibility
  public debug(message: string, meta?: any): void {
    this.log(this.createLogEntry('debug', message, this.createContext(), { metadata: meta }));
  }

  public info(message: string, meta?: any): void {
    this.log(this.createLogEntry('info', message, this.createContext(), { metadata: meta }));
  }

  public warn(message: string, meta?: any): void {
    this.log(this.createLogEntry('warn', message, this.createContext(), { metadata: meta }));
  }

  public error(message: string, meta?: any): void {
    this.log(this.createLogEntry('error', message, this.createContext(), { error: meta }));
  }

  public createLogger(name: string): KiloCodeLogger {
    // Return self for now, simplified
    return this;
  }

  // Utility methods for log analysis
  getLogsByCorrelationId(correlationId: string): LogEntry[] {
    return this.logBuffer.filter(entry => entry.context.correlationId === correlationId);
  }

  getRecentErrors(hours: number = 1): LogEntry[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.logBuffer.filter(
      entry => entry.level === 'error' &&
               new Date(entry.context.timestamp).getTime() > cutoffTime
    );
  }

  getMetricsSummary(hours: number = 1): {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    errorCount: number;
  } {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const recentLogs = this.logBuffer.filter(
      entry => new Date(entry.context.timestamp).getTime() > cutoffTime &&
               entry.metrics
    );

    const totalRequests = recentLogs.length;
    const successfulRequests = recentLogs.filter(
      entry => entry.metrics?.status === 'success'
    ).length;
    const errorCount = recentLogs.filter(
      entry => entry.metrics?.status === 'error'
    ).length;

    const responseTimes = recentLogs
      .filter(entry => entry.metrics?.duration)
      .map(entry => entry.metrics!.duration!);

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    return {
      totalRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      averageResponseTime,
      errorCount,
    };
  }

  // Export logs for analysis
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'message', 'correlationId', 'duration', 'status', 'error'];
      const rows = this.logBuffer.map(entry => [
        entry.context.timestamp,
        entry.level,
        entry.message,
        entry.context.correlationId,
        entry.metrics?.duration || '',
        entry.metrics?.status || '',
        entry.error?.message || '',
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify(this.logBuffer, null, 2);
  }
}

// Export singleton instance
export const kiloCodeLogger = KiloCodeLogger.getInstance();

