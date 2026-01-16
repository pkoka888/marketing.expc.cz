/**
 * Kilo Code API Error Handling System
 *
 * Comprehensive error handling, retry logic, and recovery mechanisms
 * for the Kilo Code API to prevent and recover from common failure scenarios.
 */

import type { APIRequest, LogContext } from './logger';
import { kiloCodeLogger } from './logger';

// Simple UUID generation for browser compatibility
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

import type { RetryConfig } from './retry';
import { ExponentialBackoffRetry, retryConfigs } from './retry';

import type { CircuitBreakerConfig } from './circuit-breaker';
import { CircuitBreaker, circuitBreakerRegistry } from './circuit-breaker';

import type { HistoryConfig, Message } from './history-manager';
import { ConversationHistoryManager } from './history-manager';

import type { RequestComplexity, TimeoutConfig } from './timeout-handler';
import { TimeoutHandler } from './timeout-handler';

import type { RecoveryResult } from './response-validator';
import { ResponseValidator, responseValidators } from './response-validator';

// Main configuration interface
export interface KiloCodeErrorHandlingConfig {
  retry?: Partial<RetryConfig>;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  history?: Partial<HistoryConfig>;
  timeout?: Partial<TimeoutConfig>;
  validator?: ResponseValidator;
  enableLogging?: boolean;
  enableFallbacks?: boolean;
}

// Main API call context
export interface APIContext {
  request: APIRequest;
  conversationHistory?: Message[];
  complexity?: Partial<RequestComplexity>;
  correlationId?: string;
  model?: string;
}

// Enhanced API response with error handling metadata
export interface EnhancedAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  metadata: {
    correlationId: string;
    duration: number;
    retryCount: number;
    circuitBreakerState?: string;
    fallbackApplied?: boolean;
    fallbackStrategy?: string;
    validationScore?: number;
    tokensUsed?: number;
  };
}

export class KiloCodeErrorHandler {
  private retryHandler: ExponentialBackoffRetry;
  private circuitBreaker: CircuitBreaker;
  private historyManager: ConversationHistoryManager;
  private timeoutHandler: TimeoutHandler;
  private validator: ResponseValidator;
  private config: KiloCodeErrorHandlingConfig;

  constructor(config: KiloCodeErrorHandlingConfig = {}) {
    this.config = {
      enableLogging: true,
      enableFallbacks: true,
      ...config,
    };

    // Initialize components with defaults or provided config
    this.retryHandler = new ExponentialBackoffRetry(this.config.retry);
    this.circuitBreaker = circuitBreakerRegistry.createBreaker(
      'kilo-code-api',
      this.config.circuitBreaker
    );
    this.historyManager = new ConversationHistoryManager(this.config.history);
    this.timeoutHandler = new TimeoutHandler(this.config.timeout);
    this.validator = this.config.validator || responseValidators.codeGeneration;
  }

  /**
   * Execute an API call with comprehensive error handling
   */
  async executeAPIRequest<T>(
    apiCall: () => Promise<T>,
    context: APIContext
  ): Promise<EnhancedAPIResponse<T>> {
    const startTime = Date.now();
    const correlationId = context.correlationId || generateUUID();

    const logContext: LogContext = {
      correlationId,
      model: context.model || 'kilo-code-api',
      provider: 'kilocode',
      timestamp: new Date().toISOString(),
    };

    let retryCount = 0;
    let circuitBreakerState = 'unknown';
    let fallbackApplied = false;
    let fallbackStrategy: string | undefined;
    let validationScore: number | undefined;
    let tokensUsed: number | undefined;

    try {
      // Log the request
      if (this.config.enableLogging) {
        kiloCodeLogger.logAPIRequest(logContext, context.request);
      }

      // Manage conversation history if provided
      if (context.conversationHistory) {
        context.conversationHistory.forEach(msg => this.historyManager.addMessage(msg));
      }

      // Estimate token usage
      tokensUsed = this.historyManager.countTotalTokens().total;

      // Execute with circuit breaker protection
      const result = await this.circuitBreaker.execute(async () => {
        // Execute with retry logic and timeout
        const timeoutResult = await this.timeoutHandler.execute(
          async () => {
            return await this.retryHandler.execute(
              apiCall,
              logContext,
              'api-call'
            );
          },
          undefined, // Use default timeout calculation
          logContext,
          context.complexity
        );

        if (timeoutResult.timedOut) {
          throw new Error(`Request timed out after ${timeoutResult.timeoutUsed}ms`);
        }

        // Note: retry count is tracked internally by the retry handler
        // For now, we don't expose the exact retry count in the result
        return timeoutResult.result;
      }, logContext);

      // Validate and recover from response issues
      let validatedResult: RecoveryResult<T>;
      if (this.config.enableFallbacks) {
        validatedResult = await this.validator.validateAndRecover(
          result,
          logContext,
          this.config.enableFallbacks
        );
        fallbackApplied = validatedResult.fallbackApplied;
        fallbackStrategy = validatedResult.fallbackStrategy;
        validationScore = validatedResult.validationResult.score;
      } else {
        // Basic validation without fallbacks
        const validationResult = this.validator.validate(result);
        validatedResult = {
          originalResponse: result,
          validatedResponse: result,
          validationResult,
          fallbackApplied: false,
          recoveryAttempts: 0,
        };
        validationScore = validationResult.score;
      }

      // Get circuit breaker state
      circuitBreakerState = this.circuitBreaker.getStats().state;

      // Log successful response
      if (this.config.enableLogging) {
        kiloCodeLogger.logAPIResponse(logContext, {
          status: 200,
          body: validatedResult.validatedResponse,
        }, {
          requestStartTime: startTime,
          requestEndTime: Date.now(),
          status: 'success',
          retryCount,
        });
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: validatedResult.validatedResponse,
        metadata: {
          correlationId,
          duration,
          retryCount,
          circuitBreakerState,
          fallbackApplied,
          fallbackStrategy,
          validationScore,
          tokensUsed,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Get circuit breaker state
      circuitBreakerState = this.circuitBreaker.getStats().state;

      // Log the error
      if (this.config.enableLogging) {
        kiloCodeLogger.logAPIError(
          logContext,
          error as Error,
          context.request,
          {
            requestStartTime: startTime,
            status: 'error',
            retryCount,
          }
        );
      }

      return {
        success: false,
        error: error as Error,
        metadata: {
          correlationId,
          duration,
          retryCount,
          circuitBreakerState,
          fallbackApplied,
          fallbackStrategy,
          validationScore,
          tokensUsed,
        },
      };
    }
  }

  /**
   * Get system health and statistics
   */
  getHealthStats() {
    const circuitBreakerStats = this.circuitBreaker.getStats();
    const timeoutStats = this.timeoutHandler.getTimeoutStats();
    const loggerStats = kiloCodeLogger.getMetricsSummary(1); // Last hour
    const historyStats = this.historyManager.getSummary();

    return {
      circuitBreaker: circuitBreakerStats,
      timeout: timeoutStats,
      logging: loggerStats,
      history: historyStats,
      overallHealth: this.calculateOverallHealth({
        circuitBreaker: circuitBreakerStats,
        logging: loggerStats,
      }),
    };
  }

  /**
   * Calculate overall system health score
   */
  private calculateOverallHealth(stats: {
    circuitBreaker: any;
    logging: any;
  }): number {
    let healthScore = 100;

    // Circuit breaker health
    if (stats.circuitBreaker.state === 'open') {
      healthScore -= 50;
    } else if (stats.circuitBreaker.state === 'half-open') {
      healthScore -= 25;
    }

    // Error rate health
    const errorRate = stats.logging.totalRequests > 0
      ? (stats.logging.errorCount / stats.logging.totalRequests) * 100
      : 0;

    if (errorRate > 20) {
      healthScore -= 30;
    } else if (errorRate > 10) {
      healthScore -= 15;
    } else if (errorRate > 5) {
      healthScore -= 5;
    }

    return Math.max(0, healthScore);
  }

  /**
   * Reset all error handling components
   */
  reset(): void {
    this.historyManager.clear();
    this.timeoutHandler.resetAdaptiveData();
    this.circuitBreaker.reset();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<KiloCodeErrorHandlingConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Re-initialize components if needed
    if (newConfig.retry) {
      this.retryHandler = new ExponentialBackoffRetry(newConfig.retry);
    }
    if (newConfig.timeout) {
      this.timeoutHandler = new TimeoutHandler(newConfig.timeout);
    }
    if (newConfig.validator) {
      this.validator = newConfig.validator;
    }
  }
}

// Pre-configured error handlers for different scenarios
export const kiloCodeErrorHandlers = {
  // Standard production handler
  production: new KiloCodeErrorHandler({
    retry: retryConfigs.standard,
    circuitBreaker: { failureThreshold: 5, recoveryTimeout: 60000 },
    history: { maxTokens: 8000, preserveSystemMessages: true },
    timeout: { defaultTimeout: 30000 },
    validator: responseValidators.codeGeneration,
  }),

  // Development handler with more lenient settings
  development: new KiloCodeErrorHandler({
    retry: retryConfigs.fast,
    circuitBreaker: { failureThreshold: 10, recoveryTimeout: 30000 },
    history: { maxTokens: 12000, preserveSystemMessages: true },
    timeout: { defaultTimeout: 60000 },
    validator: responseValidators.codeGeneration,
  }),

  // Critical operations handler
  critical: new KiloCodeErrorHandler({
    retry: retryConfigs.aggressive,
    circuitBreaker: { failureThreshold: 3, recoveryTimeout: 120000 },
    history: { maxTokens: 6000, preserveSystemMessages: true },
    timeout: { defaultTimeout: 120000 },
    validator: responseValidators.codeGeneration,
  }),

  // Lightweight handler for resource-constrained environments
  lightweight: new KiloCodeErrorHandler({
    retry: retryConfigs.conservative,
    circuitBreaker: { failureThreshold: 3, recoveryTimeout: 30000 },
    history: { maxTokens: 4000, preserveSystemMessages: false },
    timeout: { defaultTimeout: 20000 },
    validator: responseValidators.generic,
  }),
};

// Default error handler instance
export const defaultKiloCodeErrorHandler = kiloCodeErrorHandlers.production;

// Utility functions for easy integration
export async function executeWithErrorHandling<T>(
  apiCall: () => Promise<T>,
  context: APIContext,
  handler: KiloCodeErrorHandler = defaultKiloCodeErrorHandler
): Promise<EnhancedAPIResponse<T>> {
  return handler.executeAPIRequest(apiCall, context);
}

export function createErrorHandledWrapper<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  contextBuilder: (args: Parameters<T>) => APIContext,
  handler: KiloCodeErrorHandler = defaultKiloCodeErrorHandler
): T {
  return (async (...args: Parameters<T>): Promise<EnhancedAPIResponse<ReturnType<T>>> => {
    const context = contextBuilder(args);
    return handler.executeAPIRequest(() => fn(...args), context);
  }) as T;
}

// Export all components for advanced usage
export * from './circuit-breaker';
export * from './history-manager';
export * from './logger';
export * from './response-validator';
export * from './retry';
export * from './timeout-handler';

