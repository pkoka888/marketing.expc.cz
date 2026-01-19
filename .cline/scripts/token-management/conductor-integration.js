#!/usr/bin/env node

/**
 * Conductor Framework Integration
 * Integrates token management with the agent orchestration framework
 */

import fs from 'fs';
import path from 'path';
import ContextMonitor from './context-monitor.js';
import FileOptimizer from './file-optimizer.js';
import PromptCurator from './prompt-curator.js';

class ConductorIntegration {
  constructor() {
    this.projectRoot = process.cwd();
    this.clineDir = path.join(this.projectRoot, '.cline');
    this.contextFile = path.join(
      this.clineDir,
      'context',
      'current-phase.json'
    );
    this.orchestrationFile = path.join(
      this.clineDir,
      'workflows',
      'agent-orchestration.json'
    );
    this.kiloModesFile = path.join(this.projectRoot, '.kilocode', 'modes.yaml');
    this.integrationLogFile = path.join(
      this.clineDir,
      'logs',
      'conductor-integration.jsonl'
    );

    this.contextMonitor = new ContextMonitor();
    this.fileOptimizer = new FileOptimizer();
    this.promptCurator = new PromptCurator();

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
   * Monitor agent orchestration and provide token-aware suggestions
   */
  async monitorOrchestration() {
    const orchestration = this.loadOrchestration();
    const tokenUsage = this.contextMonitor.getCurrentUsage();
    const recommendations = [];

    // Analyze current orchestration state
    if (orchestration && orchestration.modes) {
      const activeModes = Object.values(orchestration.modes);

      // Check for token-intensive operations
      const tokenIntensiveModes = this.identifyTokenIntensiveModes(
        activeModes,
        tokenUsage
      );

      if (tokenIntensiveModes.length > 0) {
        recommendations.push({
          type: 'mode_optimization',
          priority: 'high',
          message:
            'Token-intensive agent modes detected. Consider optimizing file reading and prompt generation.',
          modes: tokenIntensiveModes,
          suggestions: this.generateModeOptimizationSuggestions(
            tokenIntensiveModes,
            tokenUsage
          ),
        });
      }

      // Check for coordination opportunities
      const coordinationOpportunities =
        this.identifyCoordinationOpportunities(activeModes);
      if (coordinationOpportunities.length > 0) {
        recommendations.push({
          type: 'coordination_optimization',
          priority: 'medium',
          message:
            'Opportunities for parallel execution and context sharing detected.',
          opportunities: coordinationOpportunities,
          suggestions: this.generateCoordinationSuggestions(
            coordinationOpportunities
          ),
        });
      }
    }

    // Log integration data
    this.logIntegrationData({
      timestamp: new Date().toISOString(),
      tokenUsage,
      recommendations,
      orchestrationState: 'monitored',
    });

    return {
      timestamp: new Date().toISOString(),
      tokenUsage,
      recommendations,
      orchestration: orchestration
        ? Object.keys(orchestration.modes || {})
        : [],
    };
  }

  /**
   * Optimize agent mode execution based on token constraints
   */
  async optimizeModeExecution(modeId, task, options = {}) {
    const tokenUsage = this.contextMonitor.getCurrentUsage();
    const mode = this.getModeById(modeId);

    const optimization = {
      modeId,
      originalTask: task,
      tokenUsage,
      optimizations: [],
    };

    // Apply token-aware optimizations
    if (tokenUsage.status === 'critical') {
      optimization.optimizations.push({
        type: 'task_simplification',
        message:
          'Critical token usage detected. Simplifying task to prevent context overflow.',
        action: this.simplifyTask(task, tokenUsage),
      });
    } else if (tokenUsage.status === 'warning') {
      optimization.optimizations.push({
        type: 'task_chunking',
        message:
          'High token usage detected. Consider breaking task into smaller chunks.',
        action: this.chunkTask(task, tokenUsage),
      });
    }

    // Apply mode-specific optimizations
    if (mode) {
      const modeOptimizations = this.applyModeSpecificOptimizations(
        mode,
        task,
        tokenUsage
      );
      optimization.optimizations.push(...modeOptimizations);
    }

    // Generate optimized prompt
    const optimizedPrompt = this.promptCurator.getOptimizedPrompt(task, {
      agentMode: modeId,
      tokenBudget: this.calculateOptimalTokenBudget(tokenUsage),
      contextAvailability: this.assessContextAvailability(tokenUsage),
      complexity: options.complexity || 'medium',
    });

    optimization.optimizedPrompt = optimizedPrompt;
    optimization.suggestions = this.generateExecutionSuggestions(
      modeId,
      tokenUsage
    );

    // Log optimization
    this.logIntegrationData({
      timestamp: new Date().toISOString(),
      type: 'mode_optimization',
      modeId,
      task,
      optimization,
      tokenUsage,
    });

    return optimization;
  }

  /**
   * Optimize file operations for agent modes
   */
  async optimizeFileOperations(modeId, filePaths, options = {}) {
    const optimizations = [];

    for (const filePath of filePaths) {
      const strategy = this.fileOptimizer.getReadingStrategy(filePath);

      optimizations.push({
        filePath,
        strategy: strategy.strategy,
        reason: strategy.reason,
        estimatedTokens: strategy.stats.estimatedTokens,
        recommendations: this.generateFileOptimizationRecommendations(
          strategy,
          modeId
        ),
      });
    }

    // Log file optimization
    this.logIntegrationData({
      timestamp: new Date().toISOString(),
      type: 'file_optimization',
      modeId,
      filePaths,
      optimizations,
    });

    return optimizations;
  }

  /**
   * Generate context-aware prompt suggestions
   */
  generateContextAwarePrompts(modeId, context, options = {}) {
    const tokenUsage = this.contextMonitor.getCurrentUsage();
    const mode = this.getModeById(modeId);

    const suggestions = [];

    // Generate mode-specific prompts
    if (mode) {
      const modePrompts = this.generateModeSpecificPrompts(
        mode,
        tokenUsage,
        context
      );
      suggestions.push(...modePrompts);
    }

    // Generate context-aware prompts
    const contextPrompts = this.generateContextSpecificPrompts(
      context,
      tokenUsage,
      options
    );
    suggestions.push(...contextPrompts);

    // Generate token-optimized prompts
    const optimizedPrompts = this.promptCurator.getOptimizedPrompt(
      options.task || 'Perform task',
      {
        agentMode: modeId,
        tokenBudget: this.calculateOptimalTokenBudget(tokenUsage),
        contextAvailability: this.assessContextAvailability(tokenUsage),
        ...options,
      }
    );
    suggestions.push(optimizedPrompts);

    return suggestions;
  }

  /**
   * Identify token-intensive agent modes
   */
  identifyTokenIntensiveModes(modes, tokenUsage) {
    const intensiveModes = [];

    modes.forEach((mode) => {
      // Check if mode is likely to be token-intensive
      const isIntensive = this.isTokenIntensiveMode(mode, tokenUsage);
      if (isIntensive) {
        intensiveModes.push({
          id: mode.id,
          name: mode.name,
          reason: this.getIntensiveModeReason(mode, tokenUsage),
        });
      }
    });

    return intensiveModes;
  }

  /**
   * Generate mode optimization suggestions
   */
  generateModeOptimizationSuggestions(intensiveModes, tokenUsage) {
    const suggestions = [];

    intensiveModes.forEach((mode) => {
      if (tokenUsage.status === 'critical') {
        suggestions.push({
          modeId: mode.id,
          action: 'Reduce context usage',
          details: 'Use more targeted file searches and concise prompts',
        });
      } else if (tokenUsage.status === 'warning') {
        suggestions.push({
          modeId: mode.id,
          action: 'Optimize file reading',
          details:
            'Use chunked reading for large files and targeted extraction',
        });
      }
    });

    return suggestions;
  }

  /**
   * Identify coordination opportunities
   */
  identifyCoordinationOpportunities(modes) {
    const opportunities = [];

    // Look for modes that can share context or run in parallel
    const coordinationGroups = this.findCoordinationGroups(modes);

    coordinationGroups.forEach((group) => {
      if (group.modes.length > 1) {
        opportunities.push({
          type: 'context_sharing',
          modes: group.modes,
          benefit: group.benefit,
          suggestion: this.generateCoordinationSuggestion(group),
        });
      }
    });

    return opportunities;
  }

  /**
   * Generate coordination suggestions
   */
  generateCoordinationSuggestions(opportunities) {
    return opportunities.map((opportunity) => ({
      type: opportunity.type,
      modes: opportunity.modes,
      action: 'Coordinate execution',
      details: opportunity.suggestion,
    }));
  }

  /**
   * Simplify task for critical token usage
   */
  simplifyTask(task, tokenUsage) {
    return {
      original: task,
      simplified: this.createSimplifiedTask(task),
      reason: 'Reduce token usage to prevent context overflow',
      estimatedReduction: '40-60%',
    };
  }

  /**
   * Chunk task for high token usage
   */
  chunkTask(task, tokenUsage) {
    return {
      original: task,
      chunks: this.createTaskChunks(task),
      reason: 'Break into smaller, manageable pieces',
      estimatedChunks: 3,
    };
  }

  /**
   * Apply mode-specific optimizations
   */
  applyModeSpecificOptimizations(mode, task, tokenUsage) {
    const optimizations = [];

    // Architect mode optimizations
    if (mode.id === 'architect-orchestrator') {
      optimizations.push({
        type: 'planning_optimization',
        message: 'Focus on high-level planning with minimal context details',
        action: 'Use summary-based planning instead of detailed analysis',
      });
    }

    // Frontend mode optimizations
    else if (mode.id === 'frontend-engineer') {
      optimizations.push({
        type: 'component_optimization',
        message: 'Focus on specific components rather than entire UI',
        action: 'Use targeted component development',
      });
    }

    // Backend mode optimizations
    else if (mode.id === 'backend-engineer') {
      optimizations.push({
        type: 'api_optimization',
        message: 'Focus on API endpoints rather than full system design',
        action: 'Use incremental API development',
      });
    }

    return optimizations;
  }

  /**
   * Calculate optimal token budget based on current usage
   */
  calculateOptimalTokenBudget(tokenUsage) {
    const remainingTokens = tokenUsage.maxTokens - tokenUsage.currentTokens;

    if (tokenUsage.status === 'critical') {
      return Math.min(100, remainingTokens * 0.3);
    } else if (tokenUsage.status === 'warning') {
      return Math.min(200, remainingTokens * 0.5);
    } else {
      return Math.min(400, remainingTokens * 0.7);
    }
  }

  /**
   * Assess context availability
   */
  assessContextAvailability(tokenUsage) {
    if (tokenUsage.status === 'critical') return 'low';
    if (tokenUsage.status === 'warning') return 'medium';
    return 'high';
  }

  /**
   * Generate execution suggestions
   */
  generateExecutionSuggestions(modeId, tokenUsage) {
    const suggestions = [];

    if (tokenUsage.status === 'critical') {
      suggestions.push({
        priority: 'high',
        type: 'immediate_action',
        message: 'Reduce context immediately to prevent token overflow',
      });
    }

    if (tokenUsage.status === 'warning') {
      suggestions.push({
        priority: 'medium',
        type: 'optimization',
        message: 'Implement file reading optimizations and prompt structuring',
      });
    }

    suggestions.push({
      priority: 'low',
      type: 'monitoring',
      message: 'Continue monitoring token usage throughout execution',
    });

    return suggestions;
  }

  /**
   * Generate file optimization recommendations
   */
  generateFileOptimizationRecommendations(strategy, modeId) {
    const recommendations = [];

    if (strategy.strategy === 'chunked') {
      recommendations.push({
        type: 'chunked_reading',
        message: `Use chunked reading for this large file (${strategy.stats.estimatedTokens} tokens)`,
        action: `Read in ${strategy.chunks.length} chunks`,
      });
    } else if (strategy.strategy === 'targeted') {
      recommendations.push({
        type: 'targeted_extraction',
        message: 'Use targeted extraction for structured file',
        action: 'Extract specific sections instead of reading entire file',
      });
    }

    return recommendations;
  }

  /**
   * Generate mode-specific prompts
   */
  generateModeSpecificPrompts(mode, tokenUsage, context) {
    const prompts = [];

    // Architect mode prompts
    if (mode.id === 'architect-orchestrator') {
      prompts.push({
        modeId: mode.id,
        prompt: this.createArchitectPrompt(context, tokenUsage),
        optimization: 'High-level planning with minimal context',
      });
    }

    // Frontend mode prompts
    else if (mode.id === 'frontend-engineer') {
      prompts.push({
        modeId: mode.id,
        prompt: this.createFrontendPrompt(context, tokenUsage),
        optimization: 'Component-focused with specific requirements',
      });
    }

    // Backend mode prompts
    else if (mode.id === 'backend-engineer') {
      prompts.push({
        modeId: mode.id,
        prompt: this.createBackendPrompt(context, tokenUsage),
        optimization: 'API-focused with performance constraints',
      });
    }

    return prompts;
  }

  /**
   * Generate context-specific prompts
   */
  generateContextSpecificPrompts(context, tokenUsage, options) {
    const prompts = [];

    // Context-aware prompts based on current phase
    if (context.currentPhase) {
      prompts.push({
        context: context.currentPhase,
        prompt: this.createPhaseSpecificPrompt(
          context.currentPhase,
          tokenUsage
        ),
        optimization: 'Phase-appropriate complexity',
      });
    }

    // Context-aware prompts based on system health
    if (context.systemHealth) {
      prompts.push({
        context: 'system_health',
        prompt: this.createHealthSpecificPrompt(
          context.systemHealth,
          tokenUsage
        ),
        optimization: 'Health-appropriate actions',
      });
    }

    return prompts;
  }

  // Helper methods

  async loadOrchestration() {
    try {
      if (fs.existsSync(this.orchestrationFile)) {
        return await readJsonSafe(this.orchestrationFile);
      }
    } catch (error) {
      console.warn('Could not load orchestration file:', error.message);
    }
    return null;
  }

  getModeById(modeId) {
    const orchestration = this.loadOrchestration();
    if (orchestration && orchestration.modes) {
      return orchestration.modes[modeId];
    }
    return null;
  }

  isTokenIntensiveMode(mode, tokenUsage) {
    // Modes that typically use more tokens
    const intensiveModeTypes = ['architect-orchestrator', 'qa-engineer'];
    return (
      intensiveModeTypes.includes(mode.id) || tokenUsage.status !== 'healthy'
    );
  }

  getIntensiveModeReason(mode, tokenUsage) {
    if (tokenUsage.status === 'critical') {
      return 'Critical token usage requires mode optimization';
    } else if (tokenUsage.status === 'warning') {
      return 'High token usage detected, mode may contribute';
    } else {
      return 'Mode identified as typically token-intensive';
    }
  }

  findCoordinationGroups(modes) {
    // Group modes that can coordinate
    const groups = [];

    // Architect + all other modes
    const architectMode = modes.find((m) => m.id === 'architect-orchestrator');
    if (architectMode) {
      const otherModes = modes.filter((m) => m.id !== 'architect-orchestrator');
      if (otherModes.length > 0) {
        groups.push({
          type: 'architect-coordination',
          modes: ['architect-orchestrator', ...otherModes.map((m) => m.id)],
          benefit: 'Shared context and coordinated planning',
          suggestion:
            'Use architect mode for coordination, others for execution',
        });
      }
    }

    // Frontend + Backend coordination
    const frontendMode = modes.find((m) => m.id === 'frontend-engineer');
    const backendMode = modes.find((m) => m.id === 'backend-engineer');
    if (frontendMode && backendMode) {
      groups.push({
        type: 'frontend-backend-coordination',
        modes: ['frontend-engineer', 'backend-engineer'],
        benefit: 'API contract coordination and integration',
        suggestion: 'Coordinate API contracts and data models',
      });
    }

    return groups;
  }

  generateCoordinationSuggestion(group) {
    switch (group.type) {
      case 'architect-coordination':
        return 'Use architect mode for planning, others for execution with shared context';
      case 'frontend-backend-coordination':
        return 'Coordinate API contracts and data models before implementation';
      default:
        return 'Share context and coordinate execution for optimal results';
    }
  }

  createSimplifiedTask(task) {
    // Simplify task by removing details
    return task.substring(0, Math.min(task.length, 100)) + '...';
  }

  createTaskChunks(task) {
    // Break task into logical chunks
    return [
      { part: 1, description: 'Analysis and planning' },
      { part: 2, description: 'Implementation' },
      { part: 3, description: 'Testing and validation' },
    ];
  }

  createArchitectPrompt(context, tokenUsage) {
    return `Role: Chief Architect\nTask: ${context.currentPhase || 'Project planning'}\nContext: ${tokenUsage.status}\nFocus: High-level planning with minimal context details`;
  }

  createFrontendPrompt(context, tokenUsage) {
    return `Role: Frontend Engineer\nTask: Component development\nContext: ${tokenUsage.status}\nFocus: Specific components with performance optimization`;
  }

  createBackendPrompt(context, tokenUsage) {
    return `Role: Backend Engineer\nTask: API development\nContext: ${tokenUsage.status}\nFocus: API endpoints with security and performance`;
  }

  createPhaseSpecificPrompt(phase, tokenUsage) {
    return `Current phase: ${phase}\nToken status: ${tokenUsage.status}\nOptimize prompts for phase-appropriate complexity`;
  }

  createHealthSpecificPrompt(health, tokenUsage) {
    return `System health: ${health}\nToken status: ${tokenUsage.status}\nAdjust prompts based on system capabilities`;
  }

  logIntegrationData(data) {
    try {
      const logEntry = JSON.stringify(data);
      appendLogSafe(this.integrationLogFile, logEntry);
    } catch (error) {
      console.warn('Could not log integration data:', error.message);
    }
  }
}

// CLI Interface
class ConductorIntegrationCLI {
  constructor() {
    this.integration = new ConductorIntegration();
  }

  async handleCommand(args) {
    const command = args[0] || 'help';
    const modeId = args[1];
    const task = args[2];

    switch (command) {
      case 'monitor':
        return this.monitorOrchestration();
      case 'optimize-mode':
        return this.optimizeModeExecution(modeId, task, args.slice(3));
      case 'optimize-files':
        return this.optimizeFileOperations(
          modeId,
          args.slice(2),
          args.slice(3)
        );
      case 'generate-prompts':
        return this.generateContextAwarePrompts(
          modeId,
          args.slice(2),
          args.slice(3)
        );
      default:
        return this.showHelp();
    }
  }

  async monitorOrchestration() {
    const result = await this.integration.monitorOrchestration();

    console.log('\n📊 Conductor Integration Monitor');
    console.log('='.repeat(50));
    console.log(`Token Usage: ${result.tokenUsage.percentage.toFixed(1)}%`);
    console.log(`Status: ${result.tokenUsage.status.toUpperCase()}`);
    console.log(`Active Modes: ${result.orchestration.join(', ')}`);

    if (result.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      result.recommendations.forEach((rec) => {
        console.log(`- ${rec.type}: ${rec.message}`);
      });
    }

    return result;
  }

  async optimizeModeExecution(modeId, task, options) {
    const opts = this.parseOptions(options);
    const result = await this.integration.optimizeModeExecution(
      modeId,
      task,
      opts
    );

    console.log('\n🎯 Mode Execution Optimization');
    console.log('='.repeat(50));
    console.log(`Mode: ${result.modeId}`);
    console.log(`Original Task: ${result.originalTask}`);
    console.log(`Token Usage: ${result.tokenUsage.percentage.toFixed(1)}%`);

    if (result.optimizations.length > 0) {
      console.log('\n🔧 Optimizations:');
      result.optimizations.forEach((opt) => {
        console.log(`- ${opt.type}: ${opt.message}`);
      });
    }

    console.log('\n📝 Optimized Prompt:');
    console.log(result.optimizedPrompt.prompt);

    return result;
  }

  async optimizeFileOperations(modeId, filePaths, options) {
    const result = await this.integration.optimizeFileOperations(
      modeId,
      filePaths,
      options
    );

    console.log('\n📁 File Operation Optimization');
    console.log('='.repeat(50));
    console.log(`Mode: ${modeId}`);

    result.forEach((optimization) => {
      console.log(`\nFile: ${optimization.filePath}`);
      console.log(
        `Strategy: ${optimization.strategy} (${optimization.estimatedTokens} tokens)`
      );
      console.log(`Reason: ${optimization.reason}`);

      if (optimization.recommendations.length > 0) {
        console.log('Recommendations:');
        optimization.recommendations.forEach((rec) => {
          console.log(`  - ${rec.type}: ${rec.message}`);
        });
      }
    });

    return result;
  }

  async generateContextAwarePrompts(modeId, context, options) {
    const opts = this.parseOptions(options);
    const result = this.integration.generateContextAwarePrompts(
      modeId,
      context,
      opts
    );

    console.log('\n💡 Context-Aware Prompts');
    console.log('='.repeat(50));
    console.log(`Mode: ${modeId}`);

    result.forEach((prompt, index) => {
      console.log(`\nPrompt ${index + 1}:`);
      console.log(`Type: ${prompt.modeId || prompt.context || 'general'}`);
      console.log(`Optimization: ${prompt.optimization}`);
      if (prompt.prompt) {
        console.log(`Content: ${prompt.prompt.substring(0, 100)}...`);
      } else {
        console.log(
          `Content: ${prompt.prompt || 'Optimized prompt generated'}`
        );
      }
    });

    return result;
  }

  parseOptions(args) {
    const options = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--complexity=')) {
        options.complexity = arg.split('=')[1];
      } else if (arg.startsWith('--context=')) {
        options.context = arg.split('=')[1];
      }
    }

    return options;
  }

  showHelp() {
    console.log(`
🔧 Conductor Integration CLI

USAGE:
  conductor-integration [command] [mode] [task] [options]

COMMANDS:
  monitor              Monitor orchestration and provide token-aware suggestions
  optimize-mode <mode> <task>  Optimize mode execution for token constraints
  optimize-files <mode> <files...>  Optimize file operations for agent modes
  generate-prompts <mode> <context>  Generate context-aware prompts

OPTIONS:
  --complexity=<level> Specify task complexity (low, medium, high)
  --context=<context>  Specify context information

EXAMPLES:
  conductor-integration monitor
  conductor-integration optimize-mode architect-orchestrator "Design system architecture"
  conductor-integration optimize-files frontend-engineer App.tsx styles.css
  conductor-integration generate-prompts backend-engineer "API development"
    `);
  }
}

// CLI Entry Point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const cli = new ConductorIntegrationCLI();
  cli.handleCommand(args);
}

export default ConductorIntegration;
