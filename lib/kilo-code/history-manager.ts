/**
 * Conversation History Management for Kilo Code API Error Handling
 *
 * Manages conversation history with automatic token counting and truncation
 * to prevent exceeding model context limits.
 */

import { kiloCodeLogger } from './logger';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface TokenCount {
  total: number;
  input: number;
  output: number;
  system: number;
}

export interface HistoryConfig {
  maxTokens: number; // Maximum total tokens allowed
  maxMessages: number; // Maximum number of messages
  preserveSystemMessages: boolean; // Always keep system messages
  preserveRecentMessages: number; // Number of recent messages to always keep
  truncationStrategy: 'oldest' | 'middle' | 'newest'; // How to truncate
  tokenEstimator: 'simple' | 'advanced'; // Token counting method
}

export interface TruncationResult {
  truncatedHistory: Message[];
  removedMessages: number;
  tokensRemoved: number;
  originalLength: number;
  newLength: number;
}

export class ConversationHistoryManager {
  private config: HistoryConfig;
  private history: Message[] = [];

  constructor(config: Partial<HistoryConfig> = {}) {
    this.config = {
      maxTokens: 8000, // Conservative limit for most models
      maxMessages: 100,
      preserveSystemMessages: true,
      preserveRecentMessages: 5,
      truncationStrategy: 'oldest',
      tokenEstimator: 'simple',
      ...config,
    };
  }

  /**
   * Simple token estimation (rough approximation)
   * 1 token ≈ 4 characters for English text
   */
  private estimateTokensSimple(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Advanced token estimation with better accuracy
   * Accounts for punctuation, spaces, and common patterns
   */
  private estimateTokensAdvanced(text: string): number {
    // More accurate estimation based on GPT tokenization patterns
    let tokens = 0;

    // Split by whitespace and punctuation
    const words = text.split(/(\s+|[.,!?;:"()[\]{}])/).filter(word => word.trim());

    for (const word of words) {
      if (word.length === 0) continue;

      // Common contractions and short words
      if (word.length <= 3) {
        tokens += 1;
      }
      // Longer words get more tokens
      else if (word.length <= 6) {
        tokens += Math.ceil(word.length / 3);
      }
      // Very long words
      else {
        tokens += Math.ceil(word.length / 4);
      }
    }

    return Math.max(1, tokens);
  }

  /**
   * Count tokens in a message
   */
  private countMessageTokens(message: Message): number {
    const estimator = this.config.tokenEstimator === 'advanced'
      ? this.estimateTokensAdvanced
      : this.estimateTokensSimple;

    return estimator(message.content);
  }

  /**
   * Count total tokens in history
   */
  countTotalTokens(): TokenCount {
    let total = 0;
    let input = 0;
    let output = 0;
    let system = 0;

    for (const message of this.history) {
      const tokens = this.countMessageTokens(message);
      total += tokens;

      switch (message.role) {
        case 'user':
          input += tokens;
          break;
        case 'assistant':
          output += tokens;
          break;
        case 'system':
          system += tokens;
          break;
      }
    }

    return { total, input, output, system };
  }

  /**
   * Add a message to the history
   */
  addMessage(message: Message): void {
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp || Date.now(),
    };

    this.history.push(messageWithTimestamp);

    // Check if we need to truncate
    this.maybeTruncate();
  }

  /**
   * Add multiple messages at once
   */
  addMessages(messages: Message[]): void {
    for (const message of messages) {
      this.addMessage(message);
    }
  }

  /**
   * Get current history
   */
  getHistory(): Message[] {
    return [...this.history];
  }

  /**
   * Get history length
   */
  getLength(): number {
    return this.history.length;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Remove messages from the beginning (oldest first)
   */
  private truncateOldest(targetTokens: number): TruncationResult {
    const originalHistory = [...this.history];
    const originalTokens = this.countTotalTokens().total;
    let removedMessages = 0;
    let tokensRemoved = 0;

    // Always preserve system messages if configured
    const systemMessages = this.config.preserveSystemMessages
      ? this.history.filter(msg => msg.role === 'system')
      : [];

    // Always preserve recent messages
    const recentMessages = this.history.slice(-this.config.preserveRecentMessages);

    // Messages that can be truncated
    const truncatableMessages = this.history.filter((msg, index) => {
      const isSystemMessage = msg.role === 'system';
      const isRecentMessage = index >= this.history.length - this.config.preserveRecentMessages;

      return !isSystemMessage || !this.config.preserveSystemMessages || !isRecentMessage;
    });

    // Sort by age (oldest first) but keep system messages at the end if preserving them
    truncatableMessages.sort((a, b) => {
      if (a.role === 'system' && this.config.preserveSystemMessages) return 1;
      if (b.role === 'system' && this.config.preserveSystemMessages) return -1;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });

    // Remove messages until we're under the token limit
    while (this.countTotalTokens().total > targetTokens && truncatableMessages.length > 0) {
      const messageToRemove = truncatableMessages.shift();
      if (messageToRemove) {
        const index = this.history.indexOf(messageToRemove);
        if (index !== -1) {
          this.history.splice(index, 1);
          removedMessages++;
          tokensRemoved += this.countMessageTokens(messageToRemove);
        }
      }
    }

    return {
      truncatedHistory: this.history,
      removedMessages,
      tokensRemoved,
      originalLength: originalHistory.length,
      newLength: this.history.length,
    };
  }

  /**
   * Remove messages from the middle, keeping oldest and newest
   */
  private truncateMiddle(targetTokens: number): TruncationResult {
    const originalHistory = [...this.history];
    const originalTokens = this.countTotalTokens().total;
    let removedMessages = 0;
    let tokensRemoved = 0;

    // Keep system messages, oldest, and newest messages
    const keepCount = Math.max(
      this.config.preserveRecentMessages,
      this.config.preserveSystemMessages ? this.history.filter(m => m.role === 'system').length : 0
    );

    while (this.countTotalTokens().total > targetTokens && this.history.length > keepCount * 2) {
      // Remove from the middle (skip oldest and newest)
      const removeIndex = Math.floor(this.history.length / 2);
      const removedMessage = this.history.splice(removeIndex, 1)[0];

      removedMessages++;
      tokensRemoved += this.countMessageTokens(removedMessage);
    }

    return {
      truncatedHistory: this.history,
      removedMessages,
      tokensRemoved,
      originalLength: originalHistory.length,
      newLength: this.history.length,
    };
  }

  /**
   * Keep only the most recent messages
   */
  private truncateNewest(targetTokens: number): TruncationResult {
    const originalHistory = [...this.history];
    const originalTokens = this.countTotalTokens().total;
    let removedMessages = 0;
    let tokensRemoved = 0;

    // Always preserve system messages
    const systemMessages = this.config.preserveSystemMessages
      ? this.history.filter(msg => msg.role === 'system')
      : [];

    // Keep only the most recent messages
    const keepMessages = this.history
      .filter(msg => !this.config.preserveSystemMessages || msg.role !== 'system')
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, this.config.preserveRecentMessages);

    // Rebuild history with system messages + recent messages
    this.history = [...systemMessages, ...keepMessages]
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    removedMessages = originalHistory.length - this.history.length;
    tokensRemoved = originalTokens - this.countTotalTokens().total;

    return {
      truncatedHistory: this.history,
      removedMessages,
      tokensRemoved,
      originalLength: originalHistory.length,
      newLength: this.history.length,
    };
  }

  /**
   * Truncate history based on configured strategy
   */
  truncate(targetTokens?: number): TruncationResult {
    const target = targetTokens || this.config.maxTokens;
    const currentTokens = this.countTotalTokens().total;

    if (currentTokens <= target) {
      return {
        truncatedHistory: this.history,
        removedMessages: 0,
        tokensRemoved: 0,
        originalLength: this.history.length,
        newLength: this.history.length,
      };
    }

    let result: TruncationResult;

    switch (this.config.truncationStrategy) {
      case 'middle':
        result = this.truncateMiddle(target);
        break;
      case 'newest':
        result = this.truncateNewest(target);
        break;
      case 'oldest':
      default:
        result = this.truncateOldest(target);
        break;
    }

    return result;
  }

  /**
   * Check if truncation is needed and perform it
   */
  private maybeTruncate(): void {
    const tokenCount = this.countTotalTokens();

    if (tokenCount.total > this.config.maxTokens || this.history.length > this.config.maxMessages) {
      const result = this.truncate();

      if (result.removedMessages > 0) {
        kiloCodeLogger.logHistoryTruncation(
          kiloCodeLogger.createContext({ model: 'history-manager' }),
          result.originalLength,
          result.newLength,
          result.tokensRemoved
        );
      }
    }
  }

  /**
   * Get a summary of the current history state
   */
  getSummary(): {
    messageCount: number;
    tokenCount: TokenCount;
    oldestMessage?: number;
    newestMessage?: number;
    systemMessages: number;
    userMessages: number;
    assistantMessages: number;
  } {
    const tokenCount = this.countTotalTokens();
    const timestamps = this.history.map(m => m.timestamp || 0).filter(t => t > 0);

    return {
      messageCount: this.history.length,
      tokenCount,
      oldestMessage: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestMessage: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
      systemMessages: this.history.filter(m => m.role === 'system').length,
      userMessages: this.history.filter(m => m.role === 'user').length,
      assistantMessages: this.history.filter(m => m.role === 'assistant').length,
    };
  }

  /**
   * Export history for backup or analysis
   */
  exportHistory(): {
    config: HistoryConfig;
    messages: Message[];
    summary: ReturnType<ConversationHistoryManager['getSummary']>;
    exportedAt: number;
  } {
    return {
      config: { ...this.config },
      messages: [...this.history],
      summary: this.getSummary(),
      exportedAt: Date.now(),
    };
  }

  /**
   * Import history from backup
   */
  importHistory(data: {
    messages: Message[];
    config?: Partial<HistoryConfig>;
  }): void {
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }

    this.history = data.messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp || Date.now(),
    }));

    this.maybeTruncate();
  }
}

// Pre-configured history managers for different scenarios
export const historyManagers = {
  // Standard conversation with conservative limits
  standard: new ConversationHistoryManager({
    maxTokens: 8000,
    maxMessages: 50,
    preserveSystemMessages: true,
    preserveRecentMessages: 5,
    truncationStrategy: 'oldest',
  }),

  // Long conversation with higher limits
  long: new ConversationHistoryManager({
    maxTokens: 12000,
    maxMessages: 100,
    preserveSystemMessages: true,
    preserveRecentMessages: 10,
    truncationStrategy: 'oldest',
  }),

  // Short conversation for quick interactions
  short: new ConversationHistoryManager({
    maxTokens: 4000,
    maxMessages: 20,
    preserveSystemMessages: true,
    preserveRecentMessages: 3,
    truncationStrategy: 'oldest',
  }),

  // Memory-efficient for resource-constrained environments
  memory: new ConversationHistoryManager({
    maxTokens: 2000,
    maxMessages: 10,
    preserveSystemMessages: false,
    preserveRecentMessages: 2,
    truncationStrategy: 'newest',
  }),
};

// Utility functions for common operations
export function createHistoryManager(config?: Partial<HistoryConfig>): ConversationHistoryManager {
  return new ConversationHistoryManager(config);
}

export function estimateTokens(text: string, method: 'simple' | 'advanced' = 'simple'): number {
  const manager = new ConversationHistoryManager({ tokenEstimator: method });
      return (manager as any)['estimateTokens' + (method === 'advanced' ? 'Advanced' : 'Simple')](text);}
