#!/usr/bin/env node

/**
 * Agent Interaction Testing Script
 * Tests the Kilo Code agentic framework components and interactions
 */

import fs from 'fs';
import path from 'path';

class AgentTestRunner {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  assert(condition, message) {
    this.testResults.total++;
    if (condition) {
      this.testResults.passed++;
      this.log(message, 'success');
      this.testResults.details.push({ test: message, status: 'passed' });
    } else {
      this.testResults.failed++;
      this.log(message, 'error');
      this.testResults.details.push({ test: message, status: 'failed' });
    }
  }

  async testFileExists(filePath, description) {
    try {
      await fs.promises.access(filePath);
      this.assert(true, `${description}: ${filePath} exists`);
    } catch {
      this.assert(false, `${description}: ${filePath} exists`);
    }
  }

  async testDirectoryExists(dirPath, description) {
    try {
      const stat = await fs.promises.stat(dirPath);
      this.assert(stat.isDirectory(), `${description}: ${dirPath} is a directory`);
    } catch {
      this.assert(false, `${description}: ${dirPath} exists and is a directory`);
    }
  }

  async testJSONFile(filePath, description) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      JSON.parse(content);
      this.assert(true, `${description}: ${filePath} is valid JSON`);
    } catch {
      this.assert(false, `${description}: ${filePath} is valid JSON`);
    }
  }

  async testModesConfiguration() {
    this.log('Testing modes configuration...');

    await this.testFileExists('.kilocode/modes.yaml', 'Modes configuration file');
    await this.testFileExists('.kilocode/launchConfig.json', 'Launch configuration file');

    // Test modes.yaml structure
    try {
      const content = await fs.promises.readFile('.kilocode/modes.yaml', 'utf8');
      this.assert(content.includes('customModes:'), 'Modes file contains customModes section');

      // Check for required modes
      const requiredModes = ['architect-orchestrator', 'frontend-engineer', 'backend-engineer', 'qa-engineer'];
      for (const mode of requiredModes) {
        this.assert(content.includes(`slug: ${mode}`), `Required mode '${mode}' is defined`);
      }
    } catch {
      this.assert(false, 'Modes configuration can be read and parsed');
    }
  }

  async testContextLoading() {
    this.log('Testing context loading...');

    await this.testDirectoryExists('.cline', 'Cline directory exists');
    await this.testDirectoryExists('.cline/context', 'Context directory exists');
    await this.testFileExists('.cline/context/SUMMARY.md', 'Context summary file exists');

    // Test context file size (should not be too large)
    try {
      const content = await fs.promises.readFile('.cline/context/SUMMARY.md', 'utf8');
      const lines = content.split('\n').length;
      this.assert(lines <= 50, `Context summary is not too large (${lines} lines <= 50)`);
    } catch {
      this.assert(false, 'Context summary can be read');
    }
  }

  async testMCPIntegrations() {
    this.log('Testing MCP server integrations...');

    await this.testDirectoryExists('mcp-servers', 'MCP servers directory exists');

    const expectedServers = ['monitoring', 'playwright', 'postgresql', 'redis'];
    for (const server of expectedServers) {
      await this.testDirectoryExists(`mcp-servers/${server}`, `MCP server '${server}' directory`);
      await this.testFileExists(`mcp-servers/${server}/package.json`, `MCP server '${server}' package.json`);
      await this.testFileExists(`mcp-servers/${server}/server.js`, `MCP server '${server}' implementation`);
    }
  }

  async testBaseModes() {
    this.log('Testing base modes functionality...');

    // Test that base mode files exist
    const baseModeFiles = [
      '.roo/rules-code/AGENTS.md',
      '.roo/rules-debug/AGENTS.md',
      '.roo/rules-ask/AGENTS.md'
    ];

    for (const file of baseModeFiles) {
      await this.testFileExists(file, `Base mode file ${file}`);
    }
  }

  async testAgentCreatorMode() {
    this.log('Testing Agent Creator mode...');

    // Check for agent creator related files
    await this.testFileExists('.kilocode/modes.yaml', 'Modes configuration for Agent Creator');

    try {
      const content = await fs.promises.readFile('.kilocode/modes.yaml', 'utf8');
      this.assert(content.includes('agent-creator'), 'Agent Creator mode is defined');
    } catch {
      this.assert(false, 'Agent Creator mode configuration can be checked');
    }
  }

  async testContextIntegrity() {
    this.log('Testing context integrity...');

    // Test log archival structure
    await this.testDirectoryExists('.cline/archive', 'Archive directory exists');
    await this.testDirectoryExists('.cline/archive/logs', 'Logs archive directory exists');

    // Test plans structure
    await this.testDirectoryExists('plans', 'Plans directory exists');
    await this.testDirectoryExists('plans/completed', 'Completed plans directory exists');

    // Test maintenance rules
    await this.testFileExists('.kilocode/rules/maintenance.md', 'Maintenance rules file exists');
  }

  async testKiloCodeUtilities() {
    this.log('Testing Kilo Code utilities...');

    await this.testDirectoryExists('lib/kilo-code', 'Kilo Code utilities directory exists');

    const utilities = [
      'circuit-breaker.ts',
      'history-manager.ts',
      'logger.ts',
      'response-validator.ts',
      'retry.ts',
      'timeout-handler.ts',
      'index.ts'
    ];

    for (const util of utilities) {
      await this.testFileExists(`lib/kilo-code/${util}`, `Kilo Code utility '${util}'`);
    }

    // Test package.json
    await this.testJSONFile('lib/kilo-code/package.json', 'Kilo Code package.json');
  }

  async testTestingFramework() {
    this.log('Testing testing framework setup...');

    await this.testFileExists('package.json', 'Main package.json exists');
    await this.testJSONFile('package.json', 'Main package.json is valid');

    // Check for testing dependencies
    try {
      const pkg = JSON.parse(await fs.promises.readFile('package.json', 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      this.assert(deps.jest !== undefined, 'Jest is installed');
      this.assert(deps['@playwright/test'] !== undefined, 'Playwright is installed');
      this.assert(deps['@types/jest'] !== undefined, 'Jest types are installed');
    } catch {
      this.assert(false, 'Testing dependencies can be verified');
    }

    await this.testFileExists('playwright.config.ts', 'Playwright configuration exists');
    await this.testDirectoryExists('tests', 'Tests directory exists');
  }

  async runAllTests() {
    this.log('Starting Agent Interaction Tests...');

    await this.testModesConfiguration();
    await this.testContextLoading();
    await this.testMCPIntegrations();
    await this.testBaseModes();
    await this.testAgentCreatorMode();
    await this.testContextIntegrity();
    await this.testKiloCodeUtilities();
    await this.testTestingFramework();

    this.log(`Test Results: ${this.testResults.passed}/${this.testResults.total} passed, ${this.testResults.failed} failed`);

    return this.testResults;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new AgentTestRunner();
  runner.runAllTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

export default AgentTestRunner;
