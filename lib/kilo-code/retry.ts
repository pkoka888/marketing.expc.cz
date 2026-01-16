/**
 * Retry Logic with Exponential Backoff for Kilo Code API Error Handling
 *
 * Provides automatic retry functionality with configurable backoff strategies
 * for handling transient API failures.
 */

import type { LogContext } from './logger';
import { kiloCodeLogger } from './logger';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // Base delay in milliseconds
  maxDelay: number; // Maximum delay between retries
  backoffMultiplier: number; // Exponential backoff multiplier
  retryableErrors: string[]; // Error messages/codes that should trigger retry
  jitter: boolean; // Add random jitter to prevent thundering herd
}

export interface RetryState {
  attemptNumber: number;
  totalAttempts: number;
  nextRetryTime: number;
  lastError?: Error;
}

export class RetryError extends Error {
  public readonly attemptNumber: number;
  public readonly totalAttempts: number;
  public readonly lastError: Error;

  constructor(message: string, attemptNumber: number, totalAttempts: number, lastError: Error) {
    super(message);
    this.name = 'RetryError';
    this.attemptNumber = attemptNumber;
    this.totalAttempts = totalAttempts;
    this.lastError = lastError;
  }
}

export class ExponentialBackoffRetry {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      retryableErrors: [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENOTFOUND',
        'Network Error',
        'timeout',
        'Temporary failure',
        'Rate limit exceeded',
        'Internal server error',
      ],
      jitter: true,
      ...config,
    };
  }

  /**
   * Calculate delay for the next retry attempt using exponential backoff
   */
  private calculateDelay(attemptNumber: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attemptNumber - 1);
    const delayWithJitter = this.config.jitter
      ? exponentialDelay * (0.5 + Math.random() * 0.5) // Add 50% jitter
      : exponentialDelay;

    return Math.min(delayWithJitter, this.config.maxDelay);
  }

  /**
   * Check if an error is retryable based on the configuration
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code?.toLowerCase();

    return this.config.retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError.toLowerCase()) ||
      (errorCode && errorCode.includes(retryableError.toLowerCase()))
    );
  }

  /**
   * Sleep for the specified number of milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: LogContext,
    operationName: string = 'operation'
  ): Promise<T> {
    let lastError: Error;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        kiloCodeLogger.logRetryAttempt(context, attempt, 0);

        const result = await operation();

        // Log successful retry if this wasn't the first attempt
        if (attempt > 1) {
          kiloCodeLogger.logAPIResponse(context, {
            status: 200,
            body: { success: true, attemptNumber: attempt }
          }, {
            requestStartTime: startTime,
            requestEndTime: Date.now(),
            status: 'success',
            retryCount: attempt - 1,
          });
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryableError(lastError) || attempt === this.config.maxAttempts) {
          // Log final failure
          kiloCodeLogger.logAPIError(context, lastError, undefined, {
            requestStartTime: startTime,
            status: 'error',
            retryCount: attempt - 1,
          });

          throw new RetryError(
            `Operation failed after ${attempt} attempts: ${lastError.message}`,
            attempt,
            this.config.maxAttempts,
            lastError
          );
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        const nextRetryTime = Date.now() + delay;

        // Log retry attempt
        kiloCodeLogger.logRetryAttempt(context, attempt, delay, lastError);

        // Wait before next attempt
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError!;
  }

  /**
   * Decorator for methods that need retry logic
   */
  retry(config?: Partial<RetryConfig>) {
    const retryInstance = config ? new ExponentialBackoffRetry(config) : this;

    return function <T extends any[], R>(
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: T): Promise<R> {
        const context = kiloCodeLogger.createContext({
          model: 'retry-decorator',
          sessionId: `method-${propertyKey}`,
        });

        return retryInstance.execute(
          () => originalMethod.apply(this, args),
          context,
          `${target.constructor.name}.${propertyKey}`
        );
      };

      return descriptor;
    };
  }

  /**
   * Create a retry wrapper function for one-off operations
   */
  createRetryWrapper<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    config?: Partial<RetryConfig>
  ): T {
    const retryInstance = config ? new ExponentialBackoffRetry(config) : this;

    return ((...args: Parameters<T>): Promise<ReturnType<T>> => {
      const context = kiloCodeLogger.createContext({
        model: 'retry-wrapper',
        sessionId: `wrapper-${fn.name}`,
      });

      return retryInstance.execute(
        () => fn(...args),
        context,
        fn.name || 'anonymous-function'
      );
    }) as T;
  }
}

// Default retry instance with sensible defaults
export const defaultRetry = new ExponentialBackoffRetry();

// Specialized retry configurations for different scenarios
export const retryConfigs = {
  // Fast retries for quick operations
  fast: {
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
  },

  // Standard retries for normal API calls
  standard: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },

  // Slow retries for expensive operations
  slow: {
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 1.5,
  },

  // Aggressive retries for critical operations
  aggressive: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },

  // Conservative retries for rate-limited APIs
  conservative: {
    maxAttempts: 3,
    baseDelay: 5000,
    maxDelay: 60000,
    backoffMultiplier: 1.5,
  },
};

// Utility functions for common retry patterns
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: LogContext
): Promise<T> {
  const retry = new ExponentialBackoffRetry(config);
  const logContext = context || kiloCodeLogger.createContext();

  return retry.execute(operation, logContext);
}

export function createRetryableFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): T {
  const retry = new ExponentialBackoffRetry(config);

  return retry.createRetryWrapper(fn, config);
}
