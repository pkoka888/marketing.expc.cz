#!/usr/bin/env node

/**
 * Context Monitoring and Token Management System
 * Provides real-time token usage tracking and context optimization
 */

import fs from 'fs';
import path from 'path';

class ContextMonitor {
  constructor() {
    this.projectRoot = process.cwd();
    this.clineDir = path.join(this.projectRoot, '.cline');
    this.contextFile = path.join(this.clineDir, 'context', 'current-phase.json');
    this.logsDir = path.join(this.clineDir, 'logs');
    this.tokenStatsFile = path.join(this.logsDir, 'token-usage.json');
    
    // Configuration
    this.maxContextTokens = 256000;
    this.warningThreshold = 0.8; // 80% of max context
    this.criticalThreshold = 0.9; // 90% of max context
    this.maxHistoryEntries = 100;
    
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Estimate token count for text content
   */
  estimateTokens(text) {
    if (!text) return 0;
    
    // Rough estimation: 1 token ≈ 4 characters for English text
    // More accurate: 1 token ≈ 0.75 words
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount * 0.75);
  }

  /**
   * Get current token usage statistics
   */
  getCurrentUsage() {
    const stats = this.loadTokenStats();
    const now = new Date();
    
    // Calculate current session usage
    const sessionEntries = stats.entries || [];
    const currentSession = sessionEntries.filter(entry => 
      entry.timestamp > (now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours
    );
    
    const currentTokens = currentSession.reduce((sum, entry) => sum + (entry.tokens || 0), 0);
    const percentage = (currentTokens / this.maxContextTokens) * 100;
    
    return {
      currentTokens,
      maxTokens: this.maxContextTokens,
      percentage,
      status: this.getContextStatus(percentage),
      recentEntries: currentSession.slice(-10),
      timestamp: now.toISOString()
    };
  }

  /**
   * Get context status based on usage percentage
   */
  getContextStatus(percentage) {
    if (percentage >= 90) return 'critical';
    if (percentage >= 80) return 'warning';
    if (percentage >= 60) return 'caution';
    return 'healthy';
  }

  /**
   * Log token usage for an operation
   */
  logTokenUsage(operation, tokens, details = {}) {
    const stats = this.loadTokenStats();
    const entry = {
      timestamp: Date.now(),
      operation,
      tokens,
      details,
      contextStatus: this.getContextStatus((tokens / this.maxContextTokens) * 100)
    };
    
    stats.entries = stats.entries || [];
    stats.entries.push(entry);
    
    // Keep only recent entries
    if (stats.entries.length > this.maxHistoryEntries) {
      stats.entries = stats.entries.slice(-this.maxHistoryEntries);
    }
    
    stats.lastUpdated = new Date().toISOString();
    this.saveTokenStats(stats);
    
    return entry;
  }

  /**
   * Load token usage statistics
   */
  loadTokenStats() {
    try {
      if (fs.existsSync(this.tokenStatsFile)) {
        return JSON.parse(fs.readFileSync(this.tokenStatsFile, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load token stats:', error.message);
    }
    
    return {
      entries: [],
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Save token usage statistics
   */
  saveTokenStats(stats) {
    try {
      fs.writeFileSync(this.tokenStatsFile, JSON.stringify(stats, null, 2));
    } catch (error) {
      console.warn('Could not save token stats:', error.message);
    }
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations() {
    const usage = this.getCurrentUsage();
    const recommendations = [];
    
    if (usage.status === 'critical') {
      recommendations.push({
        priority: 'high',
        type: 'context_truncation',
        message: 'Critical token usage detected. Consider truncating conversation history or summarizing recent interactions.',
        action: 'Reduce context by 30-50% immediately'
      });
    } else if (usage.status === 'warning') {
      recommendations.push({
        priority: 'medium',
        type: 'selective_reading',
        message: 'High token usage detected. Use targeted file searches instead of reading entire files.',
        action: 'Use search_files for specific content instead of read_file'
      });
    }
    
    if (usage.currentTokens > 100000) {
      recommendations.push({
        priority: 'medium',
        type: 'response_optimization',
        message: 'Large context detected. Consider using more concise response formats.',
        action: 'Use JSON format instead of verbose text when possible'
      });
    }
    
    // Check for large file operations
    const largeFileEntries = usage.recentEntries.filter(entry => 
      entry.tokens > 10000 && entry.operation.includes('read_file')
    );
    
    if (largeFileEntries.length > 0) {
      recommendations.push({
        priority: 'medium',
        type: 'file_reading_optimization',
        message: 'Large file reading detected. Consider reading files in chunks or using search_files.',
        action: 'Implement chunked file reading for files > 10KB'
      });
    }
    
    return recommendations;
  }

  /**
   * Generate context optimization report
   */
  generateReport() {
    const usage = this.getCurrentUsage();
    const recommendations = this.getOptimizationRecommendations();
    
    const report = {
      timestamp: new Date().toISOString(),
      contextUsage: usage,
      recommendations,
      summary: {
        totalOperations: usage.recentEntries.length,
        averageTokensPerOperation: usage.recentEntries.length > 0 
          ? Math.round(usage.recentEntries.reduce((sum, entry) => sum + entry.tokens, 0) / usage.recentEntries.length)
          : 0,
        maxTokensInSession: Math.max(...usage.recentEntries.map(entry => entry.tokens), 0)
      }
    };
    
    return report;
  }

  /**
   * Check if context is approaching limits and provide warnings
   */
  checkContextLimits() {
    const usage = this.getCurrentUsage();
    const warnings = [];
    
    if (usage.status === 'critical') {
      warnings.push({
        level: 'critical',
        message: `Context usage at ${usage.percentage.toFixed(1)}% (${usage.currentTokens}/${usage.maxTokens} tokens). Immediate action required.`,
        suggestions: [
          'Truncate conversation history',
          'Summarize recent interactions',
          'Use more concise responses'
        ]
      });
    } else if (usage.status === 'warning') {
      warnings.push({
        level: 'warning',
        message: `Context usage at ${usage.percentage.toFixed(1)}% (${usage.currentTokens}/${usage.maxTokens} tokens). Consider optimization.`,
        suggestions: [
          'Use targeted searches instead of full file reads',
          'Implement response length limits',
          'Monitor token usage more closely'
        ]
      });
    }
    
    return warnings;
  }

  /**
   * Reset token usage statistics
   */
  resetStats() {
    const stats = {
      entries: [],
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    };
    
    this.saveTokenStats(stats);
    return { message: 'Token usage statistics reset successfully' };
  }

  /**
   * Export token usage data for analysis
   */
  exportData(format = 'json') {
    const stats = this.loadTokenStats();
    
    if (format === 'csv') {
      const headers = ['timestamp', 'operation', 'tokens', 'contextStatus'];
      const rows = stats.entries.map(entry => [
        new Date(entry.timestamp).toISOString(),
        entry.operation,
        entry.tokens,
        entry.contextStatus
      ]);
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
    
    return JSON.stringify(stats, null, 2);
  }
}

// CLI Interface
class ContextMonitorCLI {
  constructor() {
    this.monitor = new ContextMonitor();
  }

  async handleCommand(args) {
    const command = args[0] || 'status';
    
    switch (command) {
      case 'status':
        return this.showStatus();
      case 'recommendations':
        return this.showRecommendations();
      case 'report':
        return this.showReport();
      case 'warnings':
        return this.showWarnings();
      case 'reset':
        return this.resetStats();
      case 'export':
        return this.exportData(args[1] || 'json');
      default:
        return this.showHelp();
    }
  }

  showStatus() {
    const usage = this.monitor.getCurrentUsage();
    console.log('\n📊 Context Usage Status');
    console.log('='.repeat(50));
    console.log(`Current Usage: ${usage.currentTokens.toLocaleString()} tokens`);
    console.log(`Max Capacity: ${usage.maxTokens.toLocaleString()} tokens`);
    console.log(`Usage: ${usage.percentage.toFixed(1)}%`);
    console.log(`Status: ${this.getStatusEmoji(usage.status)} ${usage.status.toUpperCase()}`);
    console.log(`Recent Operations: ${usage.recentEntries.length}`);
    console.log('');
    
    return usage;
  }

  showRecommendations() {
    const recommendations = this.monitor.getOptimizationRecommendations();
    console.log('\n💡 Optimization Recommendations');
    console.log('='.repeat(50));
    
    if (recommendations.length === 0) {
      console.log('✅ No optimization needed. Context usage is healthy.');
      return { recommendations: [] };
    }
    
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec.message}`);
      console.log(`   Priority: ${rec.priority.toUpperCase()}`);
      console.log(`   Action: ${rec.action}`);
      console.log('');
    });
    
    return { recommendations };
  }

  showReport() {
    const report = this.monitor.generateReport();
    console.log('\n📈 Context Usage Report');
    console.log('='.repeat(50));
    console.log(`Generated: ${report.timestamp}`);
    console.log('');
    console.log('Summary:');
    console.log(`- Total Operations: ${report.summary.totalOperations}`);
    console.log(`- Average Tokens/Operation: ${report.summary.averageTokensPerOperation}`);
    console.log(`- Max Tokens in Session: ${report.summary.maxTokensInSession}`);
    console.log('');
    
    if (report.recommendations.length > 0) {
      console.log('Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.message}`);
      });
    } else {
      console.log('✅ No recommendations. Context usage is optimal.');
    }
    
    return report;
  }

  showWarnings() {
    const warnings = this.monitor.checkContextLimits();
    console.log('\n⚠️ Context Warnings');
    console.log('='.repeat(50));
    
    if (warnings.length === 0) {
      console.log('✅ No warnings. Context usage is within safe limits.');
      return { warnings: [] };
    }
    
    warnings.forEach((warning, index) => {
      console.log(`${index + 1}. [${warning.level.toUpperCase()}] ${warning.message}`);
      console.log('   Suggestions:');
      warning.suggestions.forEach(suggestion => {
        console.log(`   - ${suggestion}`);
      });
      console.log('');
    });
    
    return { warnings };
  }

  resetStats() {
    const result = this.monitor.resetStats();
    console.log('\n🔄 Token Usage Statistics Reset');
    console.log('='.repeat(50));
    console.log(result.message);
    return result;
  }

  exportData(format) {
    const data = this.monitor.exportData(format);
    const filename = `token-usage-${Date.now()}.${format}`;
    const filepath = path.join(process.cwd(), filename);
    
    fs.writeFileSync(filepath, data);
    console.log(`\n📤 Token usage data exported to: ${filename}`);
    return { filename, filepath };
  }

  showHelp() {
    console.log(`
🔧 Context Monitor CLI

USAGE:
  context-monitor [command] [options]

COMMANDS:
  status          Show current context usage status
  recommendations Show optimization recommendations
  report          Generate detailed usage report
  warnings        Show context limit warnings
  reset           Reset token usage statistics
  export [format] Export usage data (json/csv)

EXAMPLES:
  context-monitor status
  context-monitor recommendations
  context-monitor export csv
  context-monitor report

CONFIGURATION:
  Max Context Tokens: ${this.monitor.maxContextTokens}
  Warning Threshold: ${(this.monitor.warningThreshold * 100)}%
  Critical Threshold: ${(this.monitor.criticalThreshold * 100)}%
    `);
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'healthy': return '💚';
      case 'caution': return '💛';
      case 'warning': return '🧡';
      case 'critical': return '❤️';
      default: return '⚪';
    }
  }
}

// CLI Entry Point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const cli = new ContextMonitorCLI();
  cli.handleCommand(args);
}

export default ContextMonitor;