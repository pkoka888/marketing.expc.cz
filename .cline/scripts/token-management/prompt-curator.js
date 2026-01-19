#!/usr/bin/env node

/**
 * Prompt Curation Framework
 * Provides curated prompt patterns and optimization strategies
 */

import fs from 'fs';
import path from 'path';

class PromptCurator {
  constructor() {
    this.projectRoot = process.cwd();
    this.clineDir = path.join(this.projectRoot, '.cline');
    this.promptsDir = path.join(this.clineDir, 'prompts');
    this.curatedPromptsFile = path.join(this.promptsDir, 'curated-prompts.json');
    this.promptLibraryFile = path.join(this.promptsDir, 'prompt-library.json');
    
    this.ensureDirectories();
    this.loadCuratedPrompts();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    if (!fs.existsSync(this.promptsDir)) {
      fs.mkdirSync(this.promptsDir, { recursive: true });
    }
  }

  /**
   * Load curated prompts from file
   */
  loadCuratedPrompts() {
    try {
      if (fs.existsSync(this.curatedPromptsFile)) {
        this.curatedPrompts = JSON.parse(fs.readFileSync(this.curatedPromptsFile, 'utf8'));
      } else {
        this.curatedPrompts = this.getDefaultCuratedPrompts();
        this.saveCuratedPrompts();
      }
    } catch (error) {
      console.warn('Could not load curated prompts:', error.message);
      this.curatedPrompts = this.getDefaultCuratedPrompts();
    }
  }

  /**
   * Save curated prompts to file
   */
  saveCuratedPrompts() {
    try {
      fs.writeFileSync(this.curatedPromptsFile, JSON.stringify(this.curatedPrompts, null, 2));
    } catch (error) {
      console.warn('Could not save curated prompts:', error.message);
    }
  }

  /**
   * Get default curated prompts
   */
  getDefaultCuratedPrompts() {
    return {
      version: '1.0.0',
      patterns: {
        'token-efficient': {
          name: 'Token Efficient',
          description: 'Optimized for minimal token usage while maintaining quality',
          patterns: [
            {
              id: 'concise-instruction',
              template: 'Task: {task}\nContext: {context}\nFormat: {format}\nConstraints: {constraints}',
              maxTokens: 150,
              useCases: ['simple tasks', 'quick queries', 'limited context']
            },
            {
              id: 'structured-response',
              template: 'Task: {task}\nSteps:\n1. {step1}\n2. {step2}\n3. {step3}\nOutput: {output_format}',
              maxTokens: 200,
              useCases: ['step-by-step tasks', 'procedural instructions']
            }
          ]
        },
        'comprehensive': {
          name: 'Comprehensive',
          description: 'Detailed prompts for complex tasks requiring thorough analysis',
          patterns: [
            {
              id: 'detailed-analysis',
              template: 'Task: {task}\n\nContext:\n{context}\n\nRequirements:\n{requirements}\n\nConstraints:\n{constraints}\n\nExpected Output:\n{output_format}\n\nSuccess Criteria:\n{success_criteria}',
              maxTokens: 500,
              useCases: ['complex analysis', 'detailed planning', 'comprehensive reviews']
            },
            {
              id: 'multi-step-process',
              template: 'Task: {task}\n\nPhase 1 - Analysis:\n{phase1}\n\nPhase 2 - Implementation:\n{phase2}\n\nPhase 3 - Validation:\n{phase3}\n\nDeliverables:\n{deliverables}',
              maxTokens: 600,
              useCases: ['multi-phase projects', 'complex implementations']
            }
          ]
        },
        'agent-specific': {
          name: 'Agent Specific',
          description: 'Optimized prompts for specific agent modes',
          patterns: [
            {
              id: 'architect-planning',
              template: 'Role: Chief Architect\nTask: {task}\n\nProject Context:\n{project_context}\n\nTechnical Requirements:\n{tech_requirements}\n\nConstraints:\n{constraints}\n\nSuccess Metrics:\n{success_metrics}\n\nOutput Format: JSON with task breakdown and validation criteria',
              maxTokens: 400,
              agentMode: 'architect-orchestrator',
              useCases: ['project planning', 'architecture design', 'technical coordination']
            },
            {
              id: 'frontend-development',
              template: 'Role: Frontend Engineer\nTask: {task}\n\nTechnology Stack: React 19, TypeScript, CSS-in-JS\n\nRequirements:\n{requirements}\n\nPerformance Constraints:\n{performance_constraints}\n\nAccessibility Requirements:\n{accessibility_requirements}\n\nOutput Format: React components with tests and documentation',
              maxTokens: 350,
              agentMode: 'frontend-engineer',
              useCases: ['component development', 'UI implementation', 'frontend optimization']
            },
            {
              id: 'backend-development',
              template: 'Role: Backend Engineer\nTask: {task}\n\nTechnology Stack: Node.js, PostgreSQL, Redis\n\nDatabase Requirements:\n{db_requirements}\n\nAPI Specifications:\n{api_specs}\n\nSecurity Constraints:\n{security_constraints}\n\nOutput Format: API specifications, database schemas, service implementations',
              maxTokens: 400,
              agentMode: 'backend-engineer',
              useCases: ['API development', 'database design', 'backend services']
            }
          ]
        },
        'context-aware': {
          name: 'Context Aware',
          description: 'Prompts that adapt based on available context and constraints',
          patterns: [
            {
              id: 'adaptive-complexity',
              template: 'Task: {task}\n\nAvailable Context: {context_availability}\n\nToken Budget: {token_budget}\n\nComplexity Level: {complexity_level}\n\nRequired Detail: {detail_level}\n\nOutput Format: {output_format}',
              maxTokens: 300,
              useCases: ['variable context scenarios', 'adaptive responses']
            },
            {
              id: 'progressive-disclosure',
              template: 'Task: {task}\n\nPhase 1 - Summary: {summary}\n\nPhase 2 - Details: {details}\n\nPhase 3 - Implementation: {implementation}\n\nToken Budget: {token_budget}',
              maxTokens: 400,
              useCases: ['complex tasks with limited context', 'progressive information delivery']
            }
          ]
        }
      },
      bestPractices: [
        {
          category: 'clarity',
          practices: [
            'Use clear, specific task descriptions',
            'Define expected output format explicitly',
            'Include success criteria and validation rules',
            'Avoid ambiguous language and assumptions'
          ]
        },
        {
          category: 'context',
          practices: [
            'Provide relevant project context',
            'Include technology stack and constraints',
            'Specify dependencies and prerequisites',
            'Mention integration points and interfaces'
          ]
        },
        {
          category: 'token-efficiency',
          practices: [
            'Use concise but complete instructions',
            'Structure information hierarchically',
            'Avoid redundant explanations',
            'Use placeholders for variable content'
          ]
        },
        {
          category: 'validation',
          practices: [
            'Include specific validation criteria',
            'Define test cases and edge cases',
            'Specify quality metrics and benchmarks',
            'Include rollback and error handling requirements'
          ]
        }
      ],
      antiPatterns: [
        {
          name: 'Vague Instructions',
          description: 'Too general or ambiguous task descriptions',
          examples: [
            'Bad: "Implement a feature"',
            'Good: "Implement user authentication with JWT tokens"'
          ]
        },
        {
          name: 'Missing Context',
          description: 'Lack of necessary project or technical context',
          examples: [
            'Bad: "Build an API"',
            'Good: "Build a REST API for user management using Node.js and PostgreSQL"'
          ]
        },
        {
          name: 'Overly Complex',
          description: 'Too much detail or complexity for the task',
          examples: [
            'Bad: 1000+ token prompt for simple task',
            'Good: 200-300 token prompt with essential details'
          ]
        },
        {
          name: 'Inconsistent Format',
          description: 'Mixed formatting and unclear structure',
          examples: [
            'Bad: Unstructured text without clear sections',
            'Good: Structured with clear headings and sections'
          ]
        }
      ]
    };
  }

  /**
   * Get optimized prompt based on context and constraints
   */
  getOptimizedPrompt(task, options = {}) {
    const {
      agentMode,
      contextAvailability = 'medium',
      tokenBudget = 300,
      complexity = 'medium',
      format = 'json'
    } = options;

    // Determine best pattern based on constraints
    const pattern = this.selectBestPattern({
      agentMode,
      contextAvailability,
      tokenBudget,
      complexity,
      format
    });

    // Generate prompt using selected pattern
    const prompt = this.generatePrompt(task, pattern, options);

    return {
      prompt,
      pattern: pattern.id,
      estimatedTokens: this.estimatePromptTokens(prompt),
      optimization: this.analyzeOptimization(prompt, tokenBudget),
      recommendations: this.getOptimizationRecommendations(prompt, tokenBudget)
    };
  }

  /**
   * Select best pattern based on constraints
   */
  selectBestPattern(options) {
    const { agentMode, tokenBudget, complexity } = options;

    // Agent-specific patterns take priority
    if (agentMode) {
      const agentPatterns = this.curatedPrompts.patterns['agent-specific'].patterns
        .filter(p => p.agentMode === agentMode);
      
      if (agentPatterns.length > 0) {
        return agentPatterns[0];
      }
    }

    // Token-efficient for small budgets
    if (tokenBudget <= 200) {
      return this.curatedPrompts.patterns['token-efficient'].patterns[0];
    }

    // Comprehensive for large budgets and high complexity
    if (tokenBudget >= 500 && complexity === 'high') {
      return this.curatedPrompts.patterns['comprehensive'].patterns[0];
    }

    // Context-aware for adaptive scenarios
    if (complexity === 'medium') {
      return this.curatedPrompts.patterns['context-aware'].patterns[0];
    }

    // Default to token-efficient
    return this.curatedPrompts.patterns['token-efficient'].patterns[0];
  }

  /**
   * Generate prompt using selected pattern
   */
  generatePrompt(task, pattern, options) {
    const { context, requirements, constraints, format } = options;
    
    // Replace placeholders in template
    let prompt = pattern.template
      .replace('{task}', task)
      .replace('{context}', context || 'Current project context')
      .replace('{requirements}', requirements || 'Standard requirements')
      .replace('{constraints}', constraints || 'No specific constraints')
      .replace('{output_format}', format || 'JSON')
      .replace('{project_context}', options.projectContext || 'MarketingPortal project')
      .replace('{tech_requirements}', options.techRequirements || 'Standard tech stack')
      .replace('{success_metrics}', options.successMetrics || 'Standard metrics')
      .replace('{context_availability}', options.contextAvailability || 'medium')
      .replace('{token_budget}', options.tokenBudget || '300')
      .replace('{complexity_level}', options.complexity || 'medium')
      .replace('{detail_level}', options.detailLevel || 'medium');

    return prompt;
  }

  /**
   * Estimate prompt tokens
   */
  estimatePromptTokens(prompt) {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Analyze prompt optimization
   */
  analyzeOptimization(prompt, tokenBudget) {
    const tokens = this.estimatePromptTokens(prompt);
    const efficiency = (tokenBudget / tokens) * 100;
    
    let status = 'optimal';
    if (efficiency < 50) status = 'inefficient';
    else if (efficiency < 80) status = 'suboptimal';
    else if (efficiency > 120) status = 'over-optimized';

    return {
      estimatedTokens: tokens,
      tokenBudget: tokenBudget,
      efficiency: Math.round(efficiency),
      status,
      suggestions: this.getOptimizationSuggestions(tokens, tokenBudget)
    };
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(tokens, tokenBudget) {
    const suggestions = [];
    
    if (tokens > tokenBudget) {
      suggestions.push({
        type: 'reduce_tokens',
        message: `Prompt exceeds budget by ${tokens - tokenBudget} tokens. Consider simplifying or using progressive disclosure.`,
        action: 'Use token-efficient pattern or break into multiple prompts'
      });
    }
    
    if (tokens < tokenBudget * 0.5) {
      suggestions.push({
        type: 'add_detail',
        message: `Prompt uses only ${Math.round((tokens / tokenBudget) * 100)}% of available tokens. Consider adding more detail.`,
        action: 'Add context, requirements, or validation criteria'
      });
    }
    
    return suggestions;
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(prompt, tokenBudget) {
    const recommendations = [];
    const tokens = this.estimatePromptTokens(prompt);
    
    // Check for common issues
    if (prompt.length > tokenBudget * 6) { // Rough character estimate
      recommendations.push({
        priority: 'high',
        type: 'length',
        message: 'Prompt is too long. Consider breaking into smaller, focused prompts.',
        action: 'Use progressive disclosure or chunk the task'
      });
    }
    
    if (!prompt.includes('Output Format')) {
      recommendations.push({
        priority: 'medium',
        type: 'structure',
        message: 'Missing explicit output format specification.',
        action: 'Add clear output format requirements'
      });
    }
    
    if (!prompt.includes('Requirements') && !prompt.includes('Constraints')) {
      recommendations.push({
        priority: 'medium',
        type: 'completeness',
        message: 'Missing requirements or constraints specification.',
        action: 'Add specific requirements and constraints'
      });
    }
    
    return recommendations;
  }

  /**
   * Validate prompt quality
   */
  validatePrompt(prompt) {
    const issues = [];
    const warnings = [];
    
    // Check for clarity
    if (prompt.length < 50) {
      warnings.push('Prompt may be too short to provide adequate context');
    }
    
    if (prompt.length > 2000) {
      issues.push('Prompt is very long and may exceed token limits');
    }
    
    // Check for structure
    const hasStructure = prompt.includes('Task:') || prompt.includes('Role:');
    if (!hasStructure) {
      warnings.push('Consider adding clear structure with headings');
    }
    
    // Check for specificity
    const vagueTerms = ['something', 'stuff', 'things', 'feature'];
    const hasVagueTerms = vagueTerms.some(term => 
      prompt.toLowerCase().includes(term)
    );
    
    if (hasVagueTerms) {
      issues.push('Prompt contains vague terms. Be more specific.');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      score: this.calculateQualityScore(prompt, issues, warnings)
    };
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(prompt, issues, warnings) {
    let score = 100;
    
    score -= issues.length * 20;
    score -= warnings.length * 10;
    
    // Bonus for good practices
    if (prompt.includes('Output Format')) score += 5;
    if (prompt.includes('Requirements')) score += 5;
    if (prompt.includes('Constraints')) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get prompt patterns by category
   */
  getPatternsByCategory(category) {
    return this.curatedPrompts.patterns[category] || null;
  }

  /**
   * Get all available patterns
   */
  getAllPatterns() {
    return this.curatedPrompts.patterns;
  }

  /**
   * Get best practices
   */
  getBestPractices() {
    return this.curatedPrompts.bestPractices;
  }

  /**
   * Get anti-patterns
   */
  getAntiPatterns() {
    return this.curatedPrompts.antiPatterns;
  }

  /**
   * Add custom pattern
   */
  addCustomPattern(category, pattern) {
    if (!this.curatedPrompts.patterns[category]) {
      this.curatedPrompts.patterns[category] = {
        name: category,
        description: 'Custom patterns',
        patterns: []
      };
    }
    
    this.curatedPrompts.patterns[category].patterns.push(pattern);
    this.saveCuratedPrompts();
    
    return { success: true, message: 'Pattern added successfully' };
  }

  /**
   * Export prompt library
   */
  exportLibrary() {
    const library = {
      patterns: this.getAllPatterns(),
      bestPractices: this.getBestPractices(),
      antiPatterns: this.getAntiPatterns(),
      exportDate: new Date().toISOString(),
      version: this.curatedPrompts.version
    };
    
    return JSON.stringify(library, null, 2);
  }
}

// CLI Interface
class PromptCuratorCLI {
  constructor() {
    this.curator = new PromptCurator();
  }

  async handleCommand(args) {
    const command = args[0] || 'help';
    const task = args[1];
    
    switch (command) {
      case 'optimize':
        return this.optimizePrompt(task, args.slice(2));
      case 'validate':
        return this.validatePrompt(task);
      case 'patterns':
        return this.showPatterns(args[1]);
      case 'best-practices':
        return this.showBestPractices();
      case 'anti-patterns':
        return this.showAntiPatterns();
      case 'export':
        return this.exportLibrary();
      default:
        return this.showHelp();
    }
  }

  async optimizePrompt(task, options) {
    const opts = this.parseOptions(options);
    const result = this.curator.getOptimizedPrompt(task, opts);
    
    console.log('\n🎯 Optimized Prompt');
    console.log('='.repeat(50));
    console.log(`Pattern: ${result.pattern}`);
    console.log(`Estimated Tokens: ${result.estimatedTokens}`);
    console.log(`Token Budget: ${opts.tokenBudget || 300}`);
    console.log(`Efficiency: ${result.optimization.efficiency}%`);
    console.log('');
    console.log('--- Generated Prompt ---');
    console.log(result.prompt);
    console.log('');
    
    if (result.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      result.recommendations.forEach(rec => {
        console.log(`- ${rec.message}`);
      });
    }
    
    return result;
  }

  validatePrompt(prompt) {
    const result = this.curator.validatePrompt(prompt);
    
    console.log('\n✅ Prompt Validation');
    console.log('='.repeat(50));
    console.log(`Quality Score: ${result.score}/100`);
    console.log(`Status: ${result.isValid ? 'VALID' : 'NEEDS IMPROVEMENT'}`);
    
    if (result.issues.length > 0) {
      console.log('\n❌ Issues:');
      result.issues.forEach(issue => console.log(`- ${issue}`));
    }
    
    if (result.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      result.warnings.forEach(warning => console.log(`- ${warning}`));
    }
    
    return result;
  }

  showPatterns(category) {
    if (category) {
      const patterns = this.curator.getPatternsByCategory(category);
      if (patterns) {
        console.log(`\n📋 Patterns for ${category}`);
        console.log('='.repeat(50));
        patterns.patterns.forEach((pattern, index) => {
          console.log(`${index + 1}. ${pattern.name} (${pattern.maxTokens} tokens)`);
          console.log(`   Use cases: ${pattern.useCases.join(', ')}`);
          console.log('');
        });
      } else {
        console.log(`No patterns found for category: ${category}`);
      }
    } else {
      const allPatterns = this.curator.getAllPatterns();
      console.log('\n📋 All Available Patterns');
      console.log('='.repeat(50));
      
      Object.keys(allPatterns).forEach(category => {
        console.log(`\n${category.toUpperCase()}:`);
        allPatterns[category].patterns.forEach((pattern, index) => {
          console.log(`  ${index + 1}. ${pattern.name} (${pattern.maxTokens} tokens)`);
        });
      });
    }
  }

  showBestPractices() {
    const practices = this.curator.getBestPractices();
    console.log('\n💡 Best Practices');
    console.log('='.repeat(50));
    
    practices.forEach(category => {
      console.log(`\n${category.category.toUpperCase()}:`);
      category.practices.forEach(practice => {
        console.log(`  • ${practice}`);
      });
    });
  }

  showAntiPatterns() {
    const antiPatterns = this.curator.getAntiPatterns();
    console.log('\n🚫 Anti-Patterns to Avoid');
    console.log('='.repeat(50));
    
    antiPatterns.forEach(pattern => {
      console.log(`\n${pattern.name}:`);
      console.log(`  ${pattern.description}`);
      pattern.examples.forEach(example => {
        console.log(`  ${example}`);
      });
    });
  }

  exportLibrary() {
    const library = this.curator.exportLibrary();
    const filename = `prompt-library-${Date.now()}.json`;
    const filepath = path.join(process.cwd(), filename);
    
    fs.writeFileSync(filepath, library);
    console.log(`\n📤 Prompt library exported to: ${filename}`);
    return { filename, filepath };
  }

  parseOptions(args) {
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--agent=')) {
        options.agentMode = arg.split('=')[1];
      } else if (arg.startsWith('--budget=')) {
        options.tokenBudget = parseInt(arg.split('=')[1]);
      } else if (arg.startsWith('--complexity=')) {
        options.complexity = arg.split('=')[1];
      } else if (arg.startsWith('--context=')) {
        options.contextAvailability = arg.split('=')[1];
      }
    }
    
    return options;
  }

  showHelp() {
    console.log(`
🔧 Prompt Curator CLI

USAGE:
  prompt-curator [command] [task] [options]

COMMANDS:
  optimize <task>      Generate optimized prompt for task
  validate <prompt>    Validate prompt quality and structure
  patterns [category]  Show available prompt patterns
  best-practices       Show prompt best practices
  anti-patterns        Show common prompt anti-patterns
  export               Export prompt library

OPTIONS:
  --agent=<mode>       Specify agent mode (architect-orchestrator, etc.)
  --budget=<tokens>    Specify token budget (default: 300)
  --complexity=<level> Specify complexity (low, medium, high)
  --context=<level>    Specify context availability

EXAMPLES:
  prompt-curator optimize "Implement user authentication"
  prompt-curator optimize "Design database schema" --agent=backend-engineer --budget=500
  prompt-curator validate "Build a feature"
  prompt-curator patterns agent-specific
    `);
  }
}

// CLI Entry Point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const cli = new PromptCuratorCLI();
  cli.handleCommand(args);
}

export default PromptCurator;