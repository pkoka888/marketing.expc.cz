#!/usr/bin/env node

/**
 * Extracts pending user tasks from agent outputs
 * Identifies tasks requiring manual user action (API keys, GitHub tokens, etc.)
 * Adds reminders to .env.local with comments
 */

const fs = require('fs');
const path = require('path');

/**
 * Analyze agent output for pending user tasks
 * @param {string} output - Agent output text
 * @returns {Array} Array of pending user tasks
 */
function extractPendingTasks(output) {
  const pendingTasks = [];
  const patterns = [
    { regex: /api\s*key/i, type: 'API_KEY', description: 'API key required' },
    { regex: /github\s*(token|key)/i, type: 'GITHUB_TOKEN', description: 'GitHub token required' },
    { regex: /environment\s*variable/i, type: 'ENV_VAR', description: 'Environment variable setup required' },
    { regex: /manual\s*(setup|configuration)/i, type: 'MANUAL_SETUP', description: 'Manual setup required' },
    { regex: /user\s*action\s*required/i, type: 'USER_ACTION', description: 'User action required' },
    { regex: /please\s*provide/i, type: 'PROVIDE_INFO', description: 'Information needs to be provided' },
    { regex: /missing\s*(credentials|config)/i, type: 'MISSING_CONFIG', description: 'Missing configuration' }
  ];

  patterns.forEach(pattern => {
    if (pattern.regex.test(output)) {
      pendingTasks.push({
        type: pattern.type,
        description: pattern.description,
        pattern: pattern.regex.toString()
      });
    }
  });

  return pendingTasks;
}

/**
 * Add reminders to .env.local file
 * @param {Array} tasks - Array of pending tasks
 */
function addEnvReminders(tasks) {
  const envFilePath = path.join(__dirname, '..', '..', '.env.local');
  let envContent = '';

  // Read existing .env.local if it exists
  if (fs.existsSync(envFilePath)) {
    envContent = fs.readFileSync(envFilePath, 'utf8');
  }

  // Add header comment if not present
  if (!envContent.includes('USER ACTION REMINDERS')) {
    envContent += `\n# ============================================\n`;
    envContent += `# USER ACTION REMINDERS\n`;
    envContent += `# Tasks requiring manual setup or configuration\n`;
    envContent += `# ============================================\n\n`;
  }

  // Add each pending task as a commented reminder
  tasks.forEach(task => {
    const reminderComment = `# 📝 ${task.description}\n`;
    const exampleComment = `# Example: ${getExampleForTask(task.type)}\n`;

    if (!envContent.includes(reminderComment)) {
      envContent += `${reminderComment}`;
      envContent += `${exampleComment}`;
      envContent += `# Status: PENDING\n\n`;
    }
  });

  // Write updated content to .env.local
  fs.writeFileSync(envFilePath, envContent);
  console.log(`✅ Added ${tasks.length} user action reminders to .env.local`);
}

/**
 * Get example configuration for task type
 * @param {string} taskType - Type of pending task
 * @returns {string} Example configuration
 */
function getExampleForTask(taskType) {
  const examples = {
    'API_KEY': 'GEMINI_API_KEY=your_api_key_here',
    'GITHUB_TOKEN': 'GITHUB_TOKEN=your_github_token_here',
    'ENV_VAR': 'VARIABLE_NAME=your_value_here',
    'MANUAL_SETUP': 'SETUP_COMPLETE=true',
    'USER_ACTION': 'ACTION_REQUIRED=description',
    'MISSING_CONFIG': 'CONFIG_PATH=/path/to/config'
  };

  return examples[taskType] || 'CONFIG_VALUE=your_value_here';
}

/**
 * Main function
 */
function main() {
  // Check if this is being run as part of agent orchestration
  const args = process.argv.slice(2);
  let output = '';

  if (args.length > 0 && args[0] === '--output') {
    // Read output from file
    const outputFile = args[1];
    try {
      output = fs.readFileSync(outputFile, 'utf8');
    } catch (error) {
      console.error(`❌ Error reading output file: ${error.message}`);
      process.exit(1);
    }
  } else {
    // Read from stdin
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let inputData = '';
    process.stdin.on('data', (chunk) => {
      inputData += chunk;
    });

    process.stdin.on('end', () => {
      output = inputData;
      processOutput(output);
    });

    return;
  }

  processOutput(output);
}

function processOutput(output) {
  console.log('🔍 Analyzing agent output for pending user tasks...');

  const pendingTasks = extractPendingTasks(output);

  if (pendingTasks.length === 0) {
    console.log('✅ No pending user tasks found in output');
    return;
  }

  console.log(`📋 Found ${pendingTasks.length} pending user tasks:`);
  pendingTasks.forEach((task, index) => {
    console.log(`${index + 1}. ${task.description} (${task.type})`);
  });

  // Add reminders to .env.local
  addEnvReminders(pendingTasks);

  // Create task list for user
  createUserTaskList(pendingTasks);
}

/**
 * Create a user task list file
 * @param {Array} tasks - Array of pending tasks
 */
function createUserTaskList(tasks) {
  const taskList = {
    timestamp: new Date().toISOString(),
    pendingTasks: tasks,
    status: 'PENDING_USER_ACTION'
  };

  const taskListPath = path.join(__dirname, '..', '..', '.cline', 'user-tasks.json');
  fs.writeFileSync(taskListPath, JSON.stringify(taskList, null, 2));

  console.log(`📄 Created user task list: ${taskListPath}`);
}

// Run main function
main();