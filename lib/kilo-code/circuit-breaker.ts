/**
 * Circuit Breaker Pattern for Kilo Code API Error Handling
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * by temporarily stopping requests when failure rates exceed thresholds.
 */

import type { LogContext } from './logger';
import { kiloCodeLogger } from './logger';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  recoveryTimeout: number; // Time in ms before attempting recovery
  monitoringPeriod: number; // Time window in ms for failure rate calculation
  successThreshold: number; // Number of successes needed in half-open state
  name: string; // Identifier for this circuit breaker
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAttemptTime?: number;
}

export class CircuitBreakerError extends Error {
  public readonly circuitName: string;
  public readonly state: CircuitState;

  constructor(message: string, circuitName: string, state: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.circuitName = circuitName;
    this.state = state;
  }
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttemptTime?: number;

  // Rolling window for failure rate calculation
  private requestHistory: Array<{ timestamp: number; success: boolean }> = [];
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 60000, // 1 minute
      successThreshold: 3,
      name: 'default-circuit',
      ...config,
    };

    // Start cleanup timer for rolling window
    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldRequests();
    }, this.config.monitoringPeriod / 4); // Clean up every quarter of monitoring period
  }

  private cleanupOldRequests(): void {
    const cutoffTime = Date.now() - this.config.monitoringPeriod;
    this.requestHistory = this.requestHistory.filter(
      request => request.timestamp > cutoffTime
    );
  }

  private recordRequest(success: boolean): void {
    const now = Date.now();
    this.requestHistory.push({ timestamp: now, success });
    this.totalRequests++;

    if (success) {
      this.successCount++;
      this.lastSuccessTime = now;
    } else {
      this.failureCount++;
      this.lastFailureTime = now;
    }
  }

  private calculateFailureRate(): number {
    const recentRequests = this.requestHistory.filter(
      request => request.timestamp > Date.now() - this.config.monitoringPeriod
    );

    if (recentRequests.length === 0) return 0;

    const failures = recentRequests.filter(request => !request.success).length;
    return failures / recentRequests.length;
  }

  private shouldOpenCircuit(): boolean {
    return this.failureCount >= this.config.failureThreshold;
  }

  private shouldCloseCircuit(): boolean {
    return this.successCount >= this.config.successThreshold;
  }

  private transitionToState(newState: CircuitState, context: LogContext): void {
    const oldState = this.state;
    this.state = newState;

    // Reset counters on state transitions
    if (newState === 'closed') {
      this.failureCount = 0;
      this.successCount = 0;
      this.nextAttemptTime = undefined;
    } else if (newState === 'half-open') {
      this.successCount = 0;
    } else if (newState === 'open') {
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
    }

    kiloCodeLogger.logCircuitBreakerState(
      context,
      newState,
      this.failureCount,
      this.nextAttemptTime
    );
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: LogContext
  ): Promise<T> {
    const now = Date.now();

    // Check if circuit should transition from open to half-open
    if (this.state === 'open' && this.nextAttemptTime && now >= this.nextAttemptTime) {
      this.transitionToState('half-open', context);
    }

    // Check circuit state
    if (this.state === 'open') {
      throw new CircuitBreakerError(
        `Circuit breaker '${this.config.name}' is OPEN`,
        this.config.name,
        this.state
      );
    }

    try {
      const result = await operation();
      this.recordRequest(true);

      // Transition from half-open to closed on success threshold
      if (this.state === 'half-open' && this.shouldCloseCircuit()) {
        this.transitionToState('closed', context);
      }

      return result;
    } catch (error) {
      this.recordRequest(false);

      // Transition to open state if failure threshold exceeded
      if (this.state === 'closed' && this.shouldOpenCircuit()) {
        this.transitionToState('open', context);
      } else if (this.state === 'half-open') {
        // Failed in half-open state, go back to open
        this.transitionToState('open', context);
      }

      throw error;
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = undefined;
  }

  /**
   * Manually open the circuit breaker
   */
  open(): void {
    this.state = 'open';
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
  }

  /**
   * Force the circuit breaker into half-open state
   */
  forceHalfOpen(): void {
    this.state = 'half-open';
    this.successCount = 0;
  }

  /**
   * Check if the circuit breaker is allowing requests
   */
  isAvailable(): boolean {
    const now = Date.now();

    if (this.state === 'closed') return true;
    if (this.state === 'open' && this.nextAttemptTime && now >= this.nextAttemptTime) {
      return true; // Will transition to half-open on next execute
    }

    return false;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}

// Circuit breaker registry for managing multiple breakers
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  createBreaker(name: string, config: Partial<CircuitBreakerConfig> = {}): CircuitBreaker {
    if (this.breakers.has(name)) {
      throw new Error(`Circuit breaker '${name}' already exists`);
    }

    const breaker = new CircuitBreaker({ ...config, name });
    this.breakers.set(name, breaker);
    return breaker;
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  getStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  destroyAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
}

// Global circuit breaker registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// Pre-configured circuit breakers for common scenarios
export const circuitBreakers = {
  // API endpoints
  api: circuitBreakerRegistry.createBreaker('api', {
    failureThreshold: 5,
    recoveryTimeout: 60000,
    successThreshold: 3,
  }),

  // External services
  externalService: circuitBreakerRegistry.createBreaker('external-service', {
    failureThreshold: 3,
    recoveryTimeout: 120000,
    successThreshold: 2,
  }),

  // Database connections
  database: circuitBreakerRegistry.createBreaker('database', {
    failureThreshold: 10,
    recoveryTimeout: 30000,
    successThreshold: 5,
  }),

  // File operations
  fileSystem: circuitBreakerRegistry.createBreaker('filesystem', {
    failureThreshold: 3,
    recoveryTimeout: 10000,
    successThreshold: 1,
  }),
};

// Utility function to execute with circuit breaker protection
export async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  breakerName: string,
  context: LogContext,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  let breaker = circuitBreakerRegistry.getBreaker(breakerName);

  if (!breaker) {
    breaker = circuitBreakerRegistry.createBreaker(breakerName, config);
  }

  return breaker.execute(operation, context);
}

// Decorator for methods that need circuit breaker protection
export function circuitBreak(breakerName: string, config?: Partial<CircuitBreakerConfig>) {
  return function <T extends any[], R>(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      const context = kiloCodeLogger.createContext({
        model: 'circuit-breaker-decorator',
        sessionId: `method-${propertyKey}`,
      });

      return withCircuitBreaker(
        () => originalMethod.apply(this, args),
        breakerName,
        context,
        config
      );
    };

    return descriptor;
  };
}
