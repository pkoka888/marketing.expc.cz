/**
 * Enhanced Timeout Handling for Kilo Code API Error Handling
 *
 * Provides configurable timeout management with graceful degradation
 * and timeout prediction based on request complexity.
 */

import type { APIRequest, LogContext } from './logger';
import { kiloCodeLogger } from './logger';

export interface TimeoutConfig {
  defaultTimeout: number; // Default timeout in milliseconds
  maxTimeout: number; // Maximum allowed timeout
  minTimeout: number; // Minimum allowed timeout
  timeoutMultiplier: number; // Multiplier for complex requests
  enableAdaptiveTimeout: boolean; // Adjust timeout based on historical data
  gracePeriod: number; // Additional time before forced cancellation
}

export interface RequestComplexity {
  contentLength: number;
  hasImages: boolean;
  hasCode: boolean;
  conversationLength: number;
  modelType: string;
}

export interface TimeoutResult<T> {
  result?: T;
  timedOut: boolean;
  duration: number;
  timeoutUsed: number;
}

export class TimeoutError extends Error {
  public readonly timeoutMs: number;
  public readonly operation: string;

  constructor(message: string, timeoutMs: number, operation: string) {
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

export class TimeoutHandler {
  private config: TimeoutConfig;
  private historicalTimeouts = new Map<string, number[]>();

  constructor(config: Partial<TimeoutConfig> = {}) {
    this.config = {
      defaultTimeout: 30000, // 30 seconds
      maxTimeout: 120000, // 2 minutes
      minTimeout: 5000, // 5 seconds
      timeoutMultiplier: 1.5,
      enableAdaptiveTimeout: true,
      gracePeriod: 2000, // 2 seconds
      ...config,
    };
  }

  /**
   * Calculate timeout based on request complexity
   */
  calculateTimeout(complexity: Partial<RequestComplexity> = {}): number {
    let baseTimeout = this.config.defaultTimeout;

    // Adjust based on content factors
    if (complexity.contentLength) {
      // Longer content needs more time (1ms per 100 characters, max 10x)
      const contentMultiplier = Math.min(10, 1 + (complexity.contentLength / 10000));
      baseTimeout *= contentMultiplier;
    }

    if (complexity.hasImages) {
      // Images significantly increase processing time
      baseTimeout *= 3;
    }

    if (complexity.hasCode) {
      // Code analysis takes longer
      baseTimeout *= 2;
    }

    if (complexity.conversationLength) {
      // Longer conversations need more time (1ms per message, max 5x)
      const conversationMultiplier = Math.min(5, 1 + (complexity.conversationLength / 20));
      baseTimeout *= conversationMultiplier;
    }

    // Model-specific adjustments
    if (complexity.modelType) {
      switch (complexity.modelType.toLowerCase()) {
        case 'gpt-4':
        case 'claude-3':
          baseTimeout *= 1.5; // More complex models
          break;
        case 'gpt-3.5-turbo':
          baseTimeout *= 0.8; // Faster model
          break;
      }
    }

    // Apply adaptive timeout if enabled
    if (this.config.enableAdaptiveTimeout) {
      baseTimeout = this.applyAdaptiveTimeout(baseTimeout, complexity);
    }

    // Apply complexity multiplier
    baseTimeout *= this.config.timeoutMultiplier;

    // Clamp to configured limits
    return Math.max(
      this.config.minTimeout,
      Math.min(this.config.maxTimeout, baseTimeout)
    );
  }

  /**
   * Apply adaptive timeout based on historical performance
   */
  private applyAdaptiveTimeout(baseTimeout: number, complexity: Partial<RequestComplexity>): number {
    // Create a key for this type of request
    const key = this.createComplexityKey(complexity);
    const historical = this.historicalTimeouts.get(key);

    if (!historical || historical.length < 3) {
      return baseTimeout; // Not enough data
    }

    // Calculate average historical duration
    const avgHistorical = historical.reduce((sum, time) => sum + time, 0) / historical.length;

    // Use historical average + 50% buffer
    const adaptiveTimeout = avgHistorical * 1.5;

    // Blend with base timeout (70% historical, 30% base)
    return (adaptiveTimeout * 0.7) + (baseTimeout * 0.3);
  }

  /**
   * Create a key for grouping similar requests
   */
  private createComplexityKey(complexity: Partial<RequestComplexity>): string {
    const factors = [
      complexity.hasImages ? 'img' : 'no-img',
      complexity.hasCode ? 'code' : 'no-code',
      complexity.modelType || 'unknown',
      Math.floor((complexity.contentLength || 0) / 1000) * 1000, // Round to nearest 1000
      Math.floor((complexity.conversationLength || 0) / 10) * 10, // Round to nearest 10
    ];

    return factors.join('-');
  }

  /**
   * Record timeout performance for adaptive learning
   */
  recordTimeoutPerformance(complexity: Partial<RequestComplexity>, actualDuration: number): void {
    if (!this.config.enableAdaptiveTimeout) return;

    const key = this.createComplexityKey(complexity);
    const historical = this.historicalTimeouts.get(key) || [];

    // Keep only last 10 measurements
    historical.push(actualDuration);
    if (historical.length > 10) {
      historical.shift();
    }

    this.historicalTimeouts.set(key, historical);
  }

  /**
   * Execute a function with timeout protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    timeoutMs?: number,
    context?: LogContext,
    complexity?: Partial<RequestComplexity>
  ): Promise<TimeoutResult<T>> {
    const actualTimeout = timeoutMs || this.calculateTimeout(complexity);
    const startTime = Date.now();

    const logContext = context || kiloCodeLogger.createContext({
      model: 'timeout-handler',
    });

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId);
        const error = new TimeoutError(
          `Operation timed out after ${actualTimeout}ms`,
          actualTimeout,
          'unknown'
        );

        kiloCodeLogger.logTimeout(logContext, actualTimeout);
        reject(error);
      }, actualTimeout);
    });

    try {
      // Race between operation and timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;

      // Record performance for adaptive timeout
      if (complexity) {
        this.recordTimeoutPerformance(complexity, duration);
      }

      return {
        result,
        timedOut: false,
        duration,
        timeoutUsed: actualTimeout,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof TimeoutError) {
        return {
          timedOut: true,
          duration,
          timeoutUsed: actualTimeout,
        };
      }

      // Re-throw non-timeout errors
      throw error;
    }
  }

  /**
   * Execute with graceful degradation - try with shorter timeout first
   */
  async executeWithGracefulDegradation<T>(
    operation: () => Promise<T>,
    primaryTimeout: number,
    fallbackTimeout: number,
    context?: LogContext,
    complexity?: Partial<RequestComplexity>
  ): Promise<TimeoutResult<T>> {
    // Try with primary timeout first
    const primaryResult = await this.execute(operation, primaryTimeout, context, complexity);

    if (!primaryResult.timedOut) {
      return primaryResult;
    }

    // If timed out, try with fallback timeout
    const logContext = context || kiloCodeLogger.createContext({
      model: 'timeout-handler-graceful',
    });

    kiloCodeLogger.logAPIRequest(logContext, {
      method: 'POST',
      url: 'graceful-degradation-fallback',
      body: { primaryTimeout, fallbackTimeout }
    });

    const fallbackResult = await this.execute(operation, fallbackTimeout, logContext, complexity);

    return fallbackResult;
  }

  /**
   * Wrap a function with timeout protection
   */
  createTimeoutWrapper<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    timeoutMs?: number,
    complexity?: Partial<RequestComplexity>
  ): T {
    return ((...args: Parameters<T>): Promise<TimeoutResult<ReturnType<T>>> => {
      return this.execute(
        () => fn(...args),
        timeoutMs,
        kiloCodeLogger.createContext({
          model: 'timeout-wrapper',
          sessionId: `function-${fn.name}`,
        }),
        complexity
      );
    }) as T;
  }

  /**
   * Get timeout statistics
   */
  getTimeoutStats(): {
    totalTrackedRequests: number;
    averageTimeout: number;
    timeoutDistribution: Record<string, number>;
  } {
    const allTimeouts: number[] = [];
    const distribution: Record<string, number> = {};

    for (const [key, timeouts] of this.historicalTimeouts) {
      allTimeouts.push(...timeouts);
      distribution[key] = timeouts.length;
    }

    const averageTimeout = allTimeouts.length > 0
      ? allTimeouts.reduce((sum, time) => sum + time, 0) / allTimeouts.length
      : 0;

    return {
      totalTrackedRequests: allTimeouts.length,
      averageTimeout,
      timeoutDistribution: distribution,
    };
  }

  /**
   * Reset adaptive timeout data
   */
  resetAdaptiveData(): void {
    this.historicalTimeouts.clear();
  }
}

// Pre-configured timeout handlers for different scenarios
export const timeoutHandlers = {
  // Fast operations (API calls, quick responses)
  fast: new TimeoutHandler({
    defaultTimeout: 10000, // 10 seconds
    maxTimeout: 30000,
    minTimeout: 3000,
  }),

  // Standard operations (normal API interactions)
  standard: new TimeoutHandler({
    defaultTimeout: 30000, // 30 seconds
    maxTimeout: 120000,
    minTimeout: 5000,
  }),

  // Slow operations (complex analysis, long generations)
  slow: new TimeoutHandler({
    defaultTimeout: 60000, // 1 minute
    maxTimeout: 300000, // 5 minutes
    minTimeout: 10000,
  }),

  // Critical operations (high priority, longer timeouts)
  critical: new TimeoutHandler({
    defaultTimeout: 120000, // 2 minutes
    maxTimeout: 600000, // 10 minutes
    minTimeout: 30000,
  }),
};

// Utility functions for common timeout patterns
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  complexity?: Partial<RequestComplexity>,
  context?: LogContext
): Promise<TimeoutResult<T>> {
  const handler = new TimeoutHandler();
  return handler.execute(operation, timeoutMs, context, complexity);
}

export function createTimeoutWrapper<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  timeoutMs: number,
  complexity?: Partial<RequestComplexity>
): T {
  const handler = new TimeoutHandler();
  return handler.createTimeoutWrapper(fn, timeoutMs, complexity);
}

export function estimateComplexity(request: APIRequest): Partial<RequestComplexity> {
  const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});
  const contentLength = body.length;

  return {
    contentLength,
    hasImages: body.includes('image') || body.includes('data:image'),
    hasCode: /\b(function|class|const|let|var|if|for|while)\b/.test(body),
    conversationLength: body.split('\n').length,
    modelType: 'unknown', // Would need to be passed from context
  };
}
