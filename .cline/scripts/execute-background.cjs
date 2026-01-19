#!/usr/bin/env node

/**
 * Execute commands in background with verbose error handling
 * Logs output to files and provides real-time status updates
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Execute command in background with logging
 * @param {string} command - Command to execute
 * @param {string} taskId - Task identifier
 * @param {string} phase - Current development phase
 * @param {boolean} verbose - Enable verbose output
 */
function executeBackgroundCommand(command, taskId, phase, verbose = true) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = path.join(__dirname, '..', 'logs');
  const outputLog = path.join(logDir, `task-${taskId}-${timestamp}.log`);
  const errorLog = path.join(logDir, `task-${taskId}-${timestamp}.error.log`);
  const statusLog = path.join(logDir, `task-${taskId}-${timestamp}.status.json`);

  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Initialize status log
  const status = {
    taskId,
    command,
    phase,
    startTime: new Date().toISOString(),
    status: 'STARTED',
    exitCode: null,
    errorCount: 0,
    warnings: 0
  };

  fs.writeFileSync(statusLog, JSON.stringify(status, null, 2));

  if (verbose) {
    console.log(`🚀 Starting background task: ${taskId}`);
    console.log(`📝 Command: ${command}`);
    console.log(`📁 Logs: ${outputLog}`);
  }

  // Execute command
  const child = spawn(command, {
    shell: true,
    stdio: 'pipe'
  });

  let stdout = '';
  let stderr = '';

  // Handle stdout
  child.stdout.on('data', (data) => {
    stdout += data.toString();
    fs.appendFileSync(outputLog, data);
    if (verbose) {
      process.stdout.write(data);
    }
  });

  // Handle stderr
  child.stderr.on('data', (data) => {
    stderr += data.toString();
    fs.appendFileSync(errorLog, data);
    if (verbose) {
      process.stderr.write(data);
    }
  });

  // Handle process exit
  child.on('close', (code) => {
    status.exitCode = code;
    status.endTime = new Date().toISOString();
    status.status = code === 0 ? 'COMPLETED' : 'FAILED';

    // Count errors and warnings
    const errorLines = stderr.split('\n').filter(line => line.includes('error'));
    const warningLines = stderr.split('\n').filter(line => line.includes('warning'));

    status.errorCount = errorLines.length;
    status.warnings = warningLines.length;

    fs.writeFileSync(statusLog, JSON.stringify(status, null, 2));

    if (code === 0) {
      if (verbose) {
        console.log(`✅ Task completed successfully: ${taskId}`);
      }
    } else {
      console.error(`❌ Task failed with exit code ${code}: ${taskId}`);
      console.error(`📄 Error log: ${errorLog}`);
      console.error(`📄 Output log: ${outputLog}`);
      console.error(`📄 Status log: ${statusLog}`);
    }

    // Create summary
    createTaskSummary(taskId, command, phase, stdout, stderr, code);
  });

  // Handle process errors
  child.on('error', (error) => {
    status.status = 'ERROR';
    status.error = error.message;
    fs.writeFileSync(statusLog, JSON.stringify(status, null, 2));

    console.error(`❌ Task execution error: ${taskId}`);
    console.error(`📄 Error: ${error.message}`);
    console.error(`📄 Status log: ${statusLog}`);
  });

  return child;
}

/**
 * Create task summary
 */
function createTaskSummary(taskId, command, phase, stdout, stderr, exitCode) {
  const summary = {
    taskId,
    command,
    phase,
    exitCode,
    status: exitCode === 0 ? 'SUCCESS' : 'FAILURE',
    summary: {
      outputLines: stdout.split('\n').length,
      errorLines: stderr.split('\n').length,
      warnings: stderr.split('\n').filter(line => line.includes('warning')).length,
      errors: stderr.split('\n').filter(line => line.includes('error')).length
    },
    keyOutputs: extractKeyOutputs(stdout),
    keyErrors: extractKeyErrors(stderr)
  };

  const summaryPath = path.join(__dirname, '..', 'logs', `task-${taskId}-summary.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  if (exitCode !== 0) {
    console.log(`📄 Task summary created: ${summaryPath}`);
  }
}

/**
 * Extract key outputs from stdout
 */
function extractKeyOutputs(stdout) {
  const keyOutputs = [];
  const lines = stdout.split('\n');

  // Look for common success indicators
  const successPatterns = [
    /success/i,
    /completed/i,
    /ready/i,
    /installed/i,
    /configured/i,
    /created/i,
    /updated/i
  ];

  lines.forEach((line, index) => {
    successPatterns.forEach(pattern => {
      if (pattern.test(line) && !keyOutputs.includes(line)) {
        keyOutputs.push(line.trim());
      }
    });
  });

  return keyOutputs.slice(0, 5); // Return top 5 key outputs
}

/**
 * Extract key errors from stderr
 */
function extractKeyErrors(stderr) {
  const keyErrors = [];
  const lines = stderr.split('\n');

  // Look for common error indicators
  const errorPatterns = [
    /error/i,
    /failed/i,
    /not found/i,
    /permission denied/i,
    /invalid/i,
    /missing/i,
    /required/i
  ];

  lines.forEach((line, index) => {
    errorPatterns.forEach(pattern => {
      if (pattern.test(line) && !keyErrors.includes(line)) {
        keyErrors.push(line.trim());
      }
    });
  });

  return keyErrors.slice(0, 5); // Return top 5 key errors
}

/**
 * Execute multiple commands in parallel
 */
function executeParallelCommands(commands, phase, verbose = true) {
  const tasks = [];

  commands.forEach((cmd, index) => {
    const taskId = `parallel-${phase}-${index}-${Date.now()}`;
    const task = executeBackgroundCommand(cmd, taskId, phase, verbose);
    tasks.push({
      taskId,
      command: cmd,
      process: task
    });
  });

  return tasks;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: execute-background.js <command> [--task-id <id>] [--phase <phase>] [--quiet]');
    console.log('Example: execute-background.js "npm install" --task-id setup-1 --phase setup');
    process.exit(1);
  }

  const command = args[0];
  let taskId = `task-${Date.now()}`;
  let phase = 'unknown';
  let verbose = true;

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--task-id' && i + 1 < args.length) {
      taskId = args[i + 1];
      i++;
    } else if (args[i] === '--phase' && i + 1 < args.length) {
      phase = args[i + 1];
      i++;
    } else if (args[i] === '--quiet') {
      verbose = false;
    }
  }

  // Execute command
  executeBackgroundCommand(command, taskId, phase, verbose);
}

// Run main function
main();