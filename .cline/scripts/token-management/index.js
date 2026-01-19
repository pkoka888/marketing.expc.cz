#!/usr/bin/env node

/**
 * Token Management and Prompt Advisor System - Main Interface
 * Unified entry point for all token management and prompt optimization features
 */

import fs from 'fs';
import path from 'path';

// Import all system components
import ContextMonitor from './context-monitor.js';
import FileOptimizer from './file-optimizer.js';
import PromptCurator from './prompt-curator.js';
import ConductorIntegration from './conductor-integration.js';

class TokenManagementSystem {
  constructor() {
    this.projectRoot = process.cwd();
    this.clineDir = path.join(this.projectRoot, '.cline');
    this.systemLogFile = path.join(this.clineDir, 'logs', 'token-management-system.jsonl');
    
    // Initialize all components
    this.contextMonitor = new ContextMonitor();
    this.fileOptimizer = new FileOptimizer();
    this.promptCurator = new PromptCurator();
    this.conductorIntegration = new ConductorIntegration();
    
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    const logsDir = path.join(this.clineDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Main system interface
   */
  async handleCommand(args) {
    const command = args[0] || 'help';
    const subcommand = args[1];
    
    // Log system usage
    this.logSystemActivity({
      timestamp: new Date().toISOString(),
      command,
      subcommand,
      args: args.slice(1)
    });

    switch (command) {
      case 'status':
        return this.showSystemStatus();
      case 'optimize':
        return this.optimizeSystem(args.slice(1));
      case 'monitor':
        return this.monitorSystem(args.slice(1));
      case 'prompt':
        return this.handlePromptCommands(subcommand, args.slice(2));
      case 'file':
        return this.handleFileCommands(subcommand, args.slice(2));
      case 'context':
        return this.handleContextCommands(subcommand, args.slice(2));
      case 'conductor':
        return this.handleConductorCommands(subcommand, args.slice(2));
      case 'integrate':
        return this.integrateWithExisting(args.slice(1));
      case 'help':
      default:
        return this.showHelp();
    }
  }

  /**
   * Show comprehensive system status
   */
  async showSystemStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      components: {},
      overallStatus: 'unknown',
      recommendations: []
    };

    // Check each component
    try {
      const tokenUsage = this.contextMonitor.getCurrentUsage();
      status.components.contextMonitor = {
        status: 'active',
        tokenUsage: {
          current: tokenUsage.currentTokens,
          max: tokenUsage.maxTokens,
          percentage: tokenUsage.percentage,
          status: tokenUsage.status
        }
      };
    } catch (error) {
      status.components.contextMonitor = { status: 'error', error: error.message };
    }

    try {
      const orchestration = this.conductorIntegration.loadOrchestration();
      status.components.conductorIntegration = {
        status: 'active',
        orchestrationLoaded: !!orchestration,
        activeModes: orchestration ? Object.keys(orchestration.modes || {}) : []
      };
    } catch (error) {
      status.components.conductorIntegration = { status: 'error', error: error.message };
    }

    try {
      const curatedPrompts = this.promptCurator.getAllPatterns();
      status.components.promptCurator = {
        status: 'active',
        patternCategories: Object.keys(curatedPrompts),
        totalPatterns: Object.values(curatedPrompts).reduce((sum, category) => sum + category.patterns.length, 0)
      };
    } catch (error) {
      status.components.promptCurator = { status: 'error', error: error.message };
    }

    // Determine overall status
    const activeComponents = Object.values(status.components).filter(c => c.status === 'active');
    if (activeComponents.length === Object.keys(status.components).length) {
      status.overallStatus = 'healthy';
    } else if (activeComponents.length >= Object.keys(status.components).length * 0.5) {
      status.overallStatus = 'warning';
    } else {
      status.overallStatus = 'critical';
    }

    // Generate recommendations
    status.recommendations = this.generateSystemRecommendations(status);

    // Display status
    this.displaySystemStatus(status);
    
    return status;
  }

  /**
   * Optimize the entire system
   */
  async optimizeSystem(args) {
    const optimizations = {
      timestamp: new Date().toISOString(),
      optimizations: [],
      results: {}
    };

    // Context optimization
    try {
      const tokenUsage = this.contextMonitor.getCurrentUsage();
      const recommendations = this.contextMonitor.getOptimizationRecommendations();
      
      optimizations.results.contextOptimization = {
        currentUsage: tokenUsage.percentage,
        recommendations: recommendations.length,
        actions: recommendations.map(r => r.message)
      };
      
      if (recommendations.length > 0) {
        optimizations.optimizations.push({
          type: 'context',
          message: `Applied ${recommendations.length} context optimizations`,
          details: recommendations
        });
      }
    } catch (error) {
      optimizations.optimizations.push({
        type: 'context',
        message: 'Context optimization failed',
        error: error.message
      });
    }

    // File optimization
    const filePaths = args.filter(arg => !arg.startsWith('--'));
    if (filePaths.length > 0) {
      try {
        const fileOptimizations = await this.fileOptimizer.readOptimized(filePaths[0]);
        optimizations.results.fileOptimization = {
          file: filePaths[0],
          strategy: fileOptimizations.strategy,
          estimatedTokens: fileOptimizations.stats?.estimatedTokens || 0
        };
        
        optimizations.optimizations.push({
          type: 'file',
          message: `Optimized file reading for ${filePaths[0]}`,
          strategy: fileOptimizations.strategy
        });
      } catch (error) {
        optimizations.optimizations.push({
          type: 'file',
          message: `File optimization failed for ${filePaths[0]}`,
          error: error.message
        });
      }
    }

    // Prompt optimization
    const task = args.find(arg => !arg.startsWith('--') && !fs.existsSync(arg));
    if (task) {
      try {
        const optimizedPrompt = this.promptCurator.getOptimizedPrompt(task, {
          tokenBudget: 300,
          complexity: 'medium'
        });
        
        optimizations.results.promptOptimization = {
          task,
          pattern: optimizedPrompt.pattern,
          estimatedTokens: optimizedPrompt.estimatedTokens,
          optimization: optimizedPrompt.optimization
        };
        
        optimizations.optimizations.push({
          type: 'prompt',
          message: `Optimized prompt for task: ${task}`,
          pattern: optimizedPrompt.pattern
        });
      } catch (error) {
        optimizations.optimizations.push({
          type: 'prompt',
          message: `Prompt optimization failed for task: ${task}`,
          error: error.message
        });
      }
    }

    // Display optimizations
    this.displayOptimizations(optimizations);
    
    return optimizations;
  }

  /**
   * Monitor system in real-time
   */
  async monitorSystem(args) {
    const monitorType = args[0] || 'all';
    const duration = parseInt(args[1]) || 60; // Default 60 seconds
    
    console.log(`\n📊 Starting ${monitorType} monitoring for ${duration} seconds...`);
    console.log('Press Ctrl+C to stop\n');

    const startTime = Date.now();
    const monitoringData = [];

    const interval = setInterval(async () => {
      const currentTime = Date.now();
      const elapsed = (currentTime - startTime) / 1000;

      if (elapsed >= duration) {
        clearInterval(interval);
        this.displayMonitoringSummary(monitoringData);
        return;
      }

      // Collect monitoring data
      const data = {
        timestamp: new Date().toISOString(),
        elapsed,
        contextUsage: this.contextMonitor.getCurrentUsage(),
        orchestration: await this.conductorIntegration.monitorOrchestration()
      };

      monitoringData.push(data);
      
      // Display current status
      this.displayMonitoringStatus(data);
    }, 5000); // Update every 5 seconds

    return { monitoringData, duration };
  }

  /**
   * Handle prompt-related commands
   */
  async handlePromptCommands(subcommand, args) {
    switch (subcommand) {
      case 'optimize':
        return this.promptCurator.getOptimizedPrompt(args.join(' '), {
          agentMode: args.find(arg => arg.startsWith('--agent='))?.split('=')[1],
          tokenBudget: parseInt(args.find(arg => arg.startsWith('--budget='))?.split('=')[1]) || 300
        });
      case 'validate':
        return this.promptCurator.validatePrompt(args.join(' '));
      case 'patterns':
        return this.promptCurator.getPatternsByCategory(args[0]) || this.promptCurator.getAllPatterns();
      case 'best-practices':
        return this.promptCurator.getBestPractices();
      case 'anti-patterns':
        return this.promptCurator.getAntiPatterns();
      default:
        console.log('Available prompt commands: optimize, validate, patterns, best-practices, anti-patterns');
        return null;
    }
  }

  /**
   * Handle file-related commands
   */
  async handleFileCommands(subcommand, args) {
    switch (subcommand) {
      case 'analyze':
        return this.fileOptimizer.getReadingStrategy(args[0]);
      case 'read':
        return this.fileOptimizer.readOptimized(args[0], this.parseFileOptions(args.slice(1)));
      case 'strategy':
        return this.fileOptimizer.getReadingStrategy(args[0]);
      default:
        console.log('Available file commands: analyze, read, strategy');
        return null;
    }
  }

  /**
   * Handle context-related commands
   */
  async handleContextCommands(subcommand, args) {
    switch (subcommand) {
      case 'status':
        return this.contextMonitor.getCurrentUsage();
      case 'recommendations':
        return this.contextMonitor.getOptimizationRecommendations();
      case 'report':
        return this.contextMonitor.generateReport();
      case 'warnings':
        return this.contextMonitor.checkContextLimits();
      case 'reset':
        return this.contextMonitor.resetStats();
      default:
        console.log('Available context commands: status, recommendations, report, warnings, reset');
        return null;
    }
  }

  /**
   * Handle conductor-related commands
   */
  async handleConductorCommands(subcommand, args) {
    switch (subcommand) {
      case 'monitor':
        return this.conductorIntegration.monitorOrchestration();
      case 'optimize-mode':
        return this.conductorIntegration.optimizeModeExecution(args[0], args[1], this.parseConductorOptions(args.slice(2)));
      case 'optimize-files':
        return this.conductorIntegration.optimizeFileOperations(args[0], args.slice(1), this.parseConductorOptions(args.slice(2)));
      case 'generate-prompts':
        return this.conductorIntegration.generateContextAwarePrompts(args[0], args.slice(1), this.parseConductorOptions(args.slice(2)));
      default:
        console.log('Available conductor commands: monitor, optimize-mode, optimize-files, generate-prompts');
        return null;
    }
  }

  /**
   * Integrate with existing systems
   */
  async integrateWithExisting(args) {
    const integration = {
      timestamp: new Date().toISOString(),
      integrations: [],
      results: {}
    };

    // Taskfile integration
    if (args.includes('taskfile') || args.includes('all')) {
      try {
        const taskfileContent = this.generateTaskfileIntegration();
        integration.results.taskfile = {
          content: taskfileContent,
          message: 'Taskfile integration generated'
        };
        integration.integrations.push('taskfile');
      } catch (error) {
        integration.integrations.push({ type: 'taskfile', error: error.message });
      }
    }

    // CI/CD integration
    if (args.includes('cicd') || args.includes('all')) {
      try {
        const cicdContent = this.generateCICDIntegration();
        integration.results.cicd = {
          content: cicdContent,
          message: 'CI/CD integration generated'
        };
        integration.integrations.push('cicd');
      } catch (error) {
        integration.integrations.push({ type: 'cicd', error: error.message });
      }
    }

    // Display integration results
    this.displayIntegrationResults(integration);
    
    return integration;
  }

  /**
   * Generate system recommendations
   */
  generateSystemRecommendations(status) {
    const recommendations = [];

    // Context recommendations
    if (status.components.contextMonitor?.tokenUsage?.status === 'warning') {
      recommendations.push({
        priority: 'high',
        type: 'context',
        message: 'High token usage detected. Consider optimizing file reading and prompt generation.',
        action: 'Use context-monitor recommendations'
      });
    }

    // Conductor recommendations
    if (status.components.conductorIntegration?.status !== 'active') {
      recommendations.push({
        priority: 'medium',
        type: 'conductor',
        message: 'Conductor integration not active. Enable for better agent coordination.',
        action: 'Check orchestration file and integration logs'
      });
    }

    // Prompt recommendations
    if (status.components.promptCurator?.status !== 'active') {
      recommendations.push({
        priority: 'medium',
        type: 'prompt',
        message: 'Prompt curator not active. Enable for better prompt quality.',
        action: 'Check curated prompts file and patterns'
      });
    }

    return recommendations;
  }

  // Display methods

  displaySystemStatus(status) {
    console.log('\n🎯 Token Management System Status');
    console.log('='.repeat(60));
    console.log(`Overall Status: ${this.getStatusEmoji(status.overallStatus)} ${status.overallStatus.toUpperCase()}`);
    console.log(`Last Updated: ${status.timestamp}`);
    console.log('');

    // Component status
    console.log('Components:');
    Object.entries(status.components).forEach(([name, component]) => {
      const statusIcon = component.status === 'active' ? '✅' : '❌';
      console.log(`  ${statusIcon} ${name}: ${component.status}`);
      if (component.error) {
        console.log(`     Error: ${component.error}`);
      }
    });

    // Token usage
    if (status.components.contextMonitor?.tokenUsage) {
      const usage = status.components.contextMonitor.tokenUsage;
      console.log(`\nToken Usage: ${usage.percentage.toFixed(1)}% (${usage.current.toLocaleString()}/${usage.max.toLocaleString()} tokens)`);
    }

    // Recommendations
    if (status.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      status.recommendations.forEach(rec => {
        console.log(`  ${rec.priority.toUpperCase()}: ${rec.message}`);
      });
    }

    console.log('');
  }

  displayOptimizations(optimizations) {
    console.log('\n🔧 System Optimizations Applied');
    console.log('='.repeat(60));
    
    optimizations.optimizations.forEach(opt => {
      console.log(`${opt.type.toUpperCase()}: ${opt.message}`);
      if (opt.strategy) {
        console.log(`  Strategy: ${opt.strategy}`);
      }
      if (opt.error) {
        console.log(`  Error: ${opt.error}`);
      }
    });

    console.log('\nResults:');
    Object.entries(optimizations.results).forEach(([type, result]) => {
      console.log(`  ${type}: ${JSON.stringify(result, null, 2)}`);
    });
    console.log('');
  }

  displayMonitoringStatus(data) {
    console.log(`\n⏱️  ${Math.round(data.elapsed)}s - Token Usage: ${data.contextUsage.percentage.toFixed(1)}%`);
    console.log(`📊 Status: ${data.contextUsage.status.toUpperCase()}`);
    console.log(`🤖 Active Modes: ${data.orchestration.orchestration.join(', ') || 'None'}`);
  }

  displayMonitoringSummary(data) {
    console.log('\n📈 Monitoring Summary');
    console.log('='.repeat(60));
    console.log(`Duration: ${data.length * 5} seconds`);
    console.log(`Data Points: ${data.length}`);
    
    const avgUsage = data.reduce((sum, d) => sum + d.contextUsage.percentage, 0) / data.length;
    console.log(`Average Token Usage: ${avgUsage.toFixed(1)}%`);
    
    const maxUsage = Math.max(...data.map(d => d.contextUsage.percentage));
    console.log(`Peak Token Usage: ${maxUsage.toFixed(1)}%`);
    console.log('');
  }

  displayIntegrationResults(integration) {
    console.log('\n🔗 Integration Results');
    console.log('='.repeat(60));
    
    integration.integrations.forEach(int => {
      if (typeof int === 'string') {
        console.log(`✅ ${int.toUpperCase()}: Integration generated`);
      } else {
        console.log(`❌ ${int.type.toUpperCase()}: ${int.error}`);
      }
    });

    if (integration.results.taskfile) {
      console.log('\n📝 Taskfile Integration:');
      console.log(integration.results.taskfile.content);
    }

    if (integration.results.cicd) {
      console.log('\n🔄 CI/CD Integration:');
      console.log(integration.results.cicd.content);
    }
    console.log('');
  }

  // Helper methods

  parseFileOptions(args) {
    const options = {};
    args.forEach(arg => {
      if (arg.startsWith('--chunk=')) {
        options.chunk = parseInt(arg.split('=')[1]);
      }
    });
    return options;
  }

  parseConductorOptions(args) {
    const options = {};
    args.forEach(arg => {
      if (arg.startsWith('--complexity=')) {
        options.complexity = arg.split('=')[1];
      }
    });
    return options;
  }

  generateTaskfileIntegration() {
    return `
# Add to your Taskfile.yml
tasks:
  token-monitor:
    desc: Monitor token usage across all components
    cmds:
      - node .cline/scripts/token-management/index.js status

  optimize-prompts:
    desc: Optimize all prompts for current context
    cmds:
      - node .cline/scripts/token-management/index.js optimize prompt

  file-optimization:
    desc: Optimize file reading for specified files
    cmds:
      - node .cline/scripts/token-management/index.js optimize file {{.FILE}}

  system-health:
    desc: Check overall system health and generate report
    cmds:
      - node .cline/scripts/token-management/index.js status
      - node .cline/scripts/token-management/index.js monitor --duration=30
`;
  }

  generateCICDIntegration() {
    return `
# Add to your .github/workflows/token-optimization.yml
name: Token Management Optimization
on: [push, pull_request]

jobs:
  token-optimization:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Monitor Token Usage
        run: node .cline/scripts/token-management/index.js context status
        
      - name: Optimize Prompts
        run: node .cline/scripts/token-management/index.js prompt optimize "CI/CD optimization"
        
      - name: Generate System Report
        run: node .cline/scripts/token-management/index.js status
`;
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'healthy': return '💚';
      case 'warning': return '💛';
      case 'critical': return '❤️';
      default: return '⚪';
    }
  }

  logSystemActivity(data) {
    try {
      const logEntry = JSON.stringify(data);
      fs.appendFileSync(this.systemLogFile, logEntry + '\n');
    } catch (error) {
      console.warn('Could not log system activity:', error.message);
    }
  }

  showHelp() {
    console.log(`
🎯 Token Management and Prompt Advisor System

USAGE:
  token-management [command] [subcommand] [options]

COMMANDS:
  status                    Show comprehensive system status
  optimize [type] [args]    Optimize system components
  monitor [type] [duration] Monitor system in real-time
  prompt [subcommand]       Handle prompt-related operations
  file [subcommand]         Handle file-related operations
  context [subcommand]      Handle context-related operations
  conductor [subcommand]    Handle conductor integration
  integrate [type]          Integrate with existing systems
  help                      Show this help message

SUBCOMMANDS:
  prompt: optimize, validate, patterns, best-practices, anti-patterns
  file: analyze, read, strategy
  context: status, recommendations, report, warnings, reset
  conductor: monitor, optimize-mode, optimize-files, generate-prompts
  integrate: taskfile, cicd, all

EXAMPLES:
  token-management status
  token-management optimize prompt "Implement user authentication"
  token-management monitor all 120
  token-management prompt validate "Build a feature"
  token-management file analyze large-file.js
  token-management integrate taskfile

INTEGRATION:
  - Automatic context monitoring and optimization
  - Real-time file reading strategy selection
  - Agent mode coordination and optimization
  - Prompt quality validation and improvement
  - Comprehensive system health monitoring
    `);
  }
}

// CLI Entry Point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const system = new TokenManagementSystem();
  system.handleCommand(args);
}

export default TokenManagementSystem;