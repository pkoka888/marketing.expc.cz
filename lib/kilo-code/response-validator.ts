/**
 * Response Validation and Error Recovery System for Kilo Code API Error Handling
 *
 * Validates API responses against schemas and provides fallback mechanisms
 * for handling malformed or empty responses.
 */

import type { LogContext } from './logger';
import { kiloCodeLogger } from './logger';

export interface ValidationRule {
  name: string;
  validate: (response: any) => boolean;
  errorMessage: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorDetails[];
  warnings: ValidationErrorDetails[];
  score: number; // 0-100, higher is better
}

export interface ValidationErrorDetails {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
  path?: string;
  value?: any;
}

export interface FallbackStrategy {
  name: string;
  condition: (response: any, errors: ValidationErrorDetails[]) => boolean;
  generateFallback: (originalResponse: any, context: LogContext) => any;
  priority: number; // Higher priority strategies are tried first
}

export interface RecoveryResult<T> {
  originalResponse: T;
  validatedResponse: T;
  validationResult: ValidationResult;
  fallbackApplied: boolean;
  fallbackStrategy?: string;
  recoveryAttempts: number;
}

export class ValidationError extends Error {
  public readonly rule: string;
  public readonly severity: 'error' | 'warning';
  public readonly path?: string;

  constructor(message: string, rule: string, severity: 'error' | 'warning' = 'error', path?: string) {
    super(message);
    this.name = 'ValidationError';
    this.rule = rule;
    this.severity = severity;
    this.path = path;
  }
}

export class ResponseValidator {
  private rules: ValidationRule[] = [];
  private fallbackStrategies: FallbackStrategy[] = [];

  /**
   * Add a validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Add a fallback strategy
   */
  addFallbackStrategy(strategy: FallbackStrategy): void {
    this.fallbackStrategies.push(strategy);
    // Sort by priority (highest first)
    this.fallbackStrategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Validate a response against all rules
   */
  validate(response: any): ValidationResult {
    const errors: ValidationErrorDetails[] = [];
    const warnings: ValidationErrorDetails[] = [];
    let score = 100;

    for (const rule of this.rules) {
      try {
        const isValid = rule.validate(response);

        if (!isValid) {
          const error: ValidationErrorDetails = {
            rule: rule.name,
            message: rule.errorMessage,
            severity: rule.severity,
          };

          if (rule.severity === 'error') {
            errors.push(error);
            score -= 20; // Errors reduce score significantly
          } else {
            warnings.push(error);
            score -= 5; // Warnings reduce score mildly
          }
        }
      } catch (error) {
        // Rule execution failed - treat as error
        errors.push({
          rule: rule.name,
          message: `Rule execution failed: ${(error as any).message}`,
          severity: 'error',
        });
        score -= 15;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score),
    };
  }

  /**
   * Apply fallback strategies to recover from validation errors
   */
  private applyFallback(
    response: any,
    validationResult: ValidationResult,
    context: LogContext
  ): { fallbackResponse: any; strategyName: string } | null {
    for (const strategy of this.fallbackStrategies) {
      if (strategy.condition(response, [...validationResult.errors, ...validationResult.warnings])) {
        try {
          const fallbackResponse = strategy.generateFallback(response, context);
          return {
            fallbackResponse,
            strategyName: strategy.name,
          };
        } catch (error) {
          // Fallback strategy failed, try next one
          kiloCodeLogger.logAPIError(context, error as Error, undefined, {
            status: 'error',
          });
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Validate and recover from response issues
   */
  async validateAndRecover<T>(
    response: T,
    context: LogContext,
    enableFallbacks: boolean = true
  ): Promise<RecoveryResult<T>> {
    const validationResult = this.validate(response);
    let validatedResponse = response;
    let fallbackApplied = false;
    let fallbackStrategy: string | undefined;
    let recoveryAttempts = 0;

    // Log validation results
    if (!validationResult.isValid) {
      kiloCodeLogger.logAPIError(context, new Error('Response validation failed'), undefined, {
        status: 'error',
      });

      // Apply fallback strategies if enabled
      if (enableFallbacks) {
        const fallback = this.applyFallback(response, validationResult, context);
        if (fallback) {
          validatedResponse = fallback.fallbackResponse as T;
          fallbackApplied = true;
          fallbackStrategy = fallback.strategyName;
          recoveryAttempts = 1;

          // Re-validate the fallback response
          const fallbackValidation = this.validate(validatedResponse);
          if (fallbackValidation.isValid) {
            kiloCodeLogger.logAPIResponse(context, {
              status: 200,
              body: { fallbackApplied: true, strategy: fallbackStrategy }
            }, {
              requestStartTime: Date.now(),
              requestEndTime: Date.now(),
              status: 'success',
            });
          }
        }
      }
    }

    return {
      originalResponse: response,
      validatedResponse,
      validationResult,
      fallbackApplied,
      fallbackStrategy,
      recoveryAttempts,
    };
  }

  /**
   * Create a validation wrapper for functions
   */
  createValidationWrapper<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    enableFallbacks: boolean = true
  ): T {
    return (async (...args: Parameters<T>): Promise<RecoveryResult<ReturnType<T>>> => {
      const context = kiloCodeLogger.createContext({
        model: 'response-validator',
        sessionId: `function-${fn.name}`,
      });

      try {
        const result = await fn(...args);
        return this.validateAndRecover(result, context, enableFallbacks);
      } catch (error) {
        // Function execution failed
        kiloCodeLogger.logAPIError(context, error as Error);
        throw error;
      }
    }) as T;
  }
}

// Pre-configured validators for common API response types
export const responseValidators = {
  // Generic API response validator
  generic: new ResponseValidator(),

  // Chat completion response validator
  chatCompletion: new ResponseValidator(),

  // Code generation response validator
  codeGeneration: new ResponseValidator(),

  // Error response validator
  errorResponse: new ResponseValidator(),
};

// Initialize validators with common rules
function initializeValidators() {
  // Generic validator rules
  responseValidators.generic.addRule({
    name: 'response-exists',
    validate: (response) => response !== null && response !== undefined,
    errorMessage: 'Response is null or undefined',
    severity: 'error',
  });

  responseValidators.generic.addRule({
    name: 'response-type',
    validate: (response) => typeof response === 'object',
    errorMessage: 'Response is not an object',
    severity: 'error',
  });

  // Chat completion specific rules
  responseValidators.chatCompletion.addRule({
    name: 'has-choices',
    validate: (response: any) => response.choices && Array.isArray(response.choices),
    errorMessage: 'Response missing choices array',
    severity: 'error',
  });

  responseValidators.chatCompletion.addRule({
    name: 'has-valid-choice',
    validate: (response: any) => response.choices && response.choices.length > 0 &&
      response.choices[0].message && response.choices[0].message.content,
    errorMessage: 'Response has no valid message content',
    severity: 'error',
  });

  responseValidators.chatCompletion.addRule({
    name: 'usage-info',
    validate: (response: any) => response.usage && typeof response.usage === 'object',
    errorMessage: 'Response missing usage information',
    severity: 'warning',
  });

  // Code generation specific rules
  responseValidators.codeGeneration.addRule({
    name: 'has-choices',
    validate: (response: any) => response.choices && Array.isArray(response.choices),
    errorMessage: 'Response missing choices array',
    severity: 'error',
  });

  responseValidators.codeGeneration.addRule({
    name: 'code-content',
    validate: (response: any) => {
      if (!response.choices || !response.choices[0]) return false;
      const content = response.choices[0].message?.content || '';
      return content.length > 0 && !content.includes('language model did not provide');
    },
    errorMessage: 'Generated code content is empty or invalid',
    severity: 'error',
  });

  // Error response rules
  responseValidators.errorResponse.addRule({
    name: 'error-structure',
    validate: (response: any) => response.error && typeof response.error === 'object',
    errorMessage: 'Error response missing error object',
    severity: 'warning',
  });

  responseValidators.errorResponse.addRule({
    name: 'error-message',
    validate: (response: any) => response.error && response.error.message,
    errorMessage: 'Error response missing message',
    severity: 'warning',
  });
}

// Initialize fallback strategies
function initializeFallbackStrategies() {
  // Generic fallback for empty responses
  responseValidators.generic.addFallbackStrategy({
    name: 'empty-response-fallback',
    condition: (response, errors) => errors.some(e => e.message.includes('null or undefined')),
    generateFallback: (original, context) => ({
      fallback: true,
      message: 'Response was empty, using fallback',
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId,
    }),
    priority: 10,
  });

  // Chat completion fallback for missing content
  responseValidators.chatCompletion.addFallbackStrategy({
    name: 'missing-content-fallback',
    condition: (response, errors) => errors.some(e => e.message.includes('no valid message content')),
    generateFallback: (original, context) => ({
      id: `fallback-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'fallback-model',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'I apologize, but I was unable to generate a response. Please try rephrasing your request.',
        },
        finish_reason: 'fallback',
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 50,
        total_tokens: 50,
      },
      fallback: true,
      correlationId: context.correlationId,
    }),
    priority: 9,
  });

  // Code generation fallback
  responseValidators.codeGeneration.addFallbackStrategy({
    name: 'code-generation-fallback',
    condition: (response, errors) => errors.some(e => e.message.includes('empty or invalid')),
    generateFallback: (original, context) => ({
      id: `fallback-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'fallback-model',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: '// Fallback: Unable to generate code\n// Please try again with a more specific request\nconsole.log("Code generation failed");',
        },
        finish_reason: 'fallback',
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 20,
        total_tokens: 20,
      },
      fallback: true,
      correlationId: context.correlationId,
    }),
    priority: 8,
  });

  // Generic structure repair fallback
  responseValidators.generic.addFallbackStrategy({
    name: 'structure-repair-fallback',
    condition: (response, errors) => errors.some(e => e.message.includes('not an object')),
    generateFallback: (original, context) => ({
      fallback: true,
      originalType: typeof original,
      message: 'Response structure was invalid, using fallback',
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId,
    }),
    priority: 1,
  });
}

// Initialize all validators and strategies
initializeValidators();
initializeFallbackStrategies();

// Utility functions
export async function validateResponse<T>(
  response: T,
  validator: ResponseValidator = responseValidators.generic,
  context?: LogContext,
  enableFallbacks: boolean = true
): Promise<RecoveryResult<T>> {
  const logContext = context || kiloCodeLogger.createContext({
    model: 'response-validation',
  });

  return validator.validateAndRecover(response, logContext, enableFallbacks);
}

export function createValidatedWrapper<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  validator: ResponseValidator = responseValidators.generic,
  enableFallbacks: boolean = true
): T {
  return validator.createValidationWrapper(fn, enableFallbacks);
}
