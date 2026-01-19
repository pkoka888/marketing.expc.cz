#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { readJsonSafe, validatePath } from './utils/safe-fs.js';

/**
 * Cline CLI (formerly local-suggest.js)
 * Replaces 'cline suggest' with local logic
 * Strictly scoped to project root
 * NOW SUPPORTS:
 * - .kilocode/modes.yaml
 * - --agent flag
 * - --orch (list modes)
 * - --orchplan (suggest next phase from plan)
 * - --refine (meta-prompt optimization)
 * - Variable Interpolation {{var}}
 */

const PROMPTS_DIR = path.join(process.cwd(), '.cline', 'prompts');
const CONTEXT_FILE = path.join(
  process.cwd(),
  '.cline',
  'context',
  'current-phase.json'
);
const KILO_MODES_FILE = path.join(process.cwd(), '.kilocode', 'modes.yaml');
const PLAN_FILE = path.join(process.cwd(), 'plans', 'roadmap_4_months.md');
const TASKFILE = path.join(process.cwd(), 'Taskfile.yml');
const CONTEXT_MAP_FILE = path.join(
  process.cwd(),
  '.cline',
  'context',
  'SUMMARY.md'
);
const CONTEXT_LOADER_FILE = path.join(
  process.cwd(),
  '.cline',
  'context-loader.yaml'
);

// Simple YAML parser for Kilo Code modes structure
function parseKiloModes(content) {
  const lines = content.split('\n');
  const modes = [];
  let currentMode = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (line.includes('slug:')) {
      if (currentMode) modes.push(currentMode);
      currentMode = {
        slug: line.split('slug:')[1].trim(),
        roleDefinition: '',
        customInstructions: '',
      };
    } else if (currentMode) {
      if (line.includes('name:'))
        currentMode.name = line.split('name:')[1].trim();
      else if (line.includes('roleDefinition: >'))
        currentMode.readingRole = true;
      else if (line.includes('customInstructions: >')) {
        currentMode.readingRole = false;
        currentMode.readingInstructions = true;
      } else if (
        line.includes('slug:') ||
        (trimmed.endsWith(':') && !trimmed.startsWith('customInstructions'))
      ) {
        currentMode.readingRole = false;
        currentMode.readingInstructions = false;
      } else if (currentMode.readingRole)
        currentMode.roleDefinition += line.trim() + ' ';
      else if (currentMode.readingInstructions)
        currentMode.customInstructions += line.trim() + ' ';
    }
  }
  if (currentMode) modes.push(currentMode);
  return modes;
}

function processTemplate(content, variables = {}) {
  let processed = content;
  // Remove frontmatter if present (simplified)
  processed = processed.replace(/^---[\s\S]*?---\n/, '');

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, value);
  }
  return processed;
}

async function main() {
  const args = process.argv.slice(2);
  let phase = null;
  let context = null;
  let agentMode = null;
  let command = 'suggest'; // Default command
  let refinePrompt = null;
  let contextScenario = 'default';
  let templateVars = {};

  // Arg parsing
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--orch') command = 'orch';
    if (arg === '--orchplan') command = 'orchplan';
    if (arg === '--scenario') {
      contextScenario = args[i + 1];
      i++;
      // If called directly, implies mapping context
      if (command === 'suggest') command = 'map';
    }
    if (arg === '--refine') {
      command = 'refine';
      refinePrompt = args[i + 1]; // Grab next arg as prompt
      i++; // skip next
    }
    if (arg === '--map') command = 'map';

    // Check for variable assignments like goal="do something"
    if (arg.includes('=') && !arg.startsWith('--')) {
      const [key, val] = arg.split('=');
      templateVars[key] = val;
    }

    if (arg.startsWith('--phase')) {
      phase = arg.includes('=') ? arg.split('=')[1] : args[i + 1];
    }
    if (arg.startsWith('--context')) {
      context = arg.includes('=') ? arg.split('=')[1] : args[i + 1];
    }
    if (arg.startsWith('--agent') || arg.startsWith('--mode')) {
      agentMode = arg.includes('=') ? arg.split('=')[1] : args[i + 1];
    }
  }

  try {
    if (command === 'orch') {
      await listOrchestrationModes();
    } else if (command === 'orchplan') {
      await suggestFromPlan();
    } else if (command === 'refine') {
      await refineUserPrompt(refinePrompt);
    } else if (command === 'map') {
      // If scenario is provided, we ASSEMBLE, else we just INDEX
      if (contextScenario !== 'default' || args.includes('--assemble')) {
        await assembleContext(contextScenario);
      } else {
        await generateContextMap();
      }
    } else {
      // Fallback to current-phase.json if not provided
      if (!phase) {
        const currentState = await readJsonSafe(CONTEXT_FILE);
        if (currentState) phase = currentState.phase;
      }

      if (!phase) {
        console.error('Error: No phase specified and no current phase found.');
        process.exit(1);
      }
      const suggestion = await generateSuggestion(phase, context, agentMode);
      console.log(JSON.stringify(suggestion, null, 2));
    }
  } catch (error) {
    console.error('Error executing command:', error); // Fixed error logging
    process.exit(1);
  }
}

async function refineUserPrompt(userPrompt) {
  const metaPath = path.join(PROMPTS_DIR, 'tasks', 'meta-refiner.md');
  if (!fs.existsSync(metaPath)) {
    console.log('MetaRefiner template missing.');
    return;
  }

  const template = fs.readFileSync(metaPath, 'utf8');
  const refinedInstruction = processTemplate(template, {
    user_prompt: userPrompt || 'No prompt provided',
  });

  console.log('--- OPTIMIZED INSTRUCTION FOR AGENT ---');
  console.log(refinedInstruction.trim());
  console.log('---------------------------------------');
  console.log('(Copy the above text and paste it to your Agent)');
}

async function generateContextMap() {
  let output = '# Project Context Map (Dynamic Index)\n\n';
  output += `Generated: ${new Date().toISOString()}\n\n`;

  // 1. Current Phase
  output += '## 1. Current State\n';
  const state = await readJsonSafe(CONTEXT_FILE);
  if (state) {
    output += `- **Phase**: ${state.phase}\n`;
    if (typeof state.context === 'object') {
      output += `- **Context**:\n\`\`\`json\n${JSON.stringify(state.context, null, 2)}\n\`\`\`\n`;
    } else {
      output += `- **Context**: ${state.context}\n`;
    }
    output += `- **Last Update**: ${state.startTime}\n`;
  } else {
    output += '- *No active phase context found.*\n';
  }
  output += '\n';

  // 2. Capabilities (Modes)
  output += '## 2. Capabilities (Kilo Modes)\n';
  if (fs.existsSync(KILO_MODES_FILE)) {
    const modes = parseKiloModes(fs.readFileSync(KILO_MODES_FILE, 'utf8'));
    modes.forEach((m) => (output += `- **${m.slug}**: ${m.name}\n`));
  } else {
    output += '- *No Kilo modes found.*\n';
  }
  output += '\n';

  // 3. Recommended Actions (Taskfile)
  output += '## 3. Recommended Actions (Taskfile)\n';
  if (fs.existsSync(TASKFILE)) {
    const tf = fs.readFileSync(TASKFILE, 'utf8');
    const lines = tf.split('\n');
    let inTask = false;
    lines.forEach((line) => {
      // Simple naive parsing of 'desc:'
      if (line.includes('desc:')) {
        const desc = line.split('desc:')[1].trim().replace(/['"]/g, '');
        // Try to find the task name (approximate due to yaml)
        // This is a "Must Know" summary, not a parser
        output += `- ${desc}\n`;
      }
    });
  }
  output += '\n';

  // 4. Knowledge Index (Prompts)
  output += '## 4. Knowledge Index (Prompts)\n';
  if (fs.existsSync(PROMPTS_DIR)) {
    function walk(dir, indent = '') {
      const files = fs.readdirSync(dir);
      files.forEach((f) => {
        const fp = path.join(dir, f);
        if (fs.statSync(fp).isDirectory()) {
          output += `${indent}- **${f}/**\n`;
          walk(fp, indent + '  ');
        } else if (f.endsWith('.md')) {
          output += `${indent}- [${f}](file://${fp})\n`;
        }
      });
    }
    walk(PROMPTS_DIR);
  }

  fs.writeFileSync(CONTEXT_MAP_FILE, output);
  console.log(`Context Map updated: ${CONTEXT_MAP_FILE}`);
}

// Simple YAML parser for Context Loader (supports basic arrays and keys)
function parseContextLoader(content) {
  const scenarios = {};
  let currentScenario = null;
  let currentKey = null; // description, include, instructions

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Scenario Definition (e.g., "default:")
    if (line.match(/^[a-z0-9_-]+:$/i)) {
      const name = line.replace(':', '').trim();
      currentScenario = {
        name,
        include: [],
        description: '',
        instructions: '',
      };
      scenarios[name] = currentScenario;
      currentKey = null;
    }
    // Properties (indentation implies content)
    else if (currentScenario) {
      if (trimmed.startsWith('description:'))
        currentScenario.description = trimmed
          .split('description:')[1]
          .trim()
          .replace(/['"]/g, '');
      else if (trimmed.startsWith('instructions:'))
        currentScenario.instructions = trimmed
          .split('instructions:')[1]
          .trim()
          .replace(/['"]/g, '');
      else if (trimmed.startsWith('include:')) currentKey = 'include';
      else if (trimmed.startsWith('-') && currentKey === 'include') {
        currentScenario.include.push(trimmed.replace('-', '').trim());
      }
    }
  }
  return scenarios;
}

async function assembleContext(scenarioName) {
  if (!fs.existsSync(CONTEXT_LOADER_FILE)) {
    console.log('No context-loader.yaml found. Generating generic map...');
    await generateContextMap();
    return;
  }

  console.log(`Assembling Context for Scenario: ${scenarioName}...`);
  const loaderContent = fs.readFileSync(CONTEXT_LOADER_FILE, 'utf8');
  const scenarios = parseContextLoader(loaderContent);
  const scenario = scenarios[scenarioName] || scenarios['default'];

  if (!scenario) {
    console.error(`Scenario '${scenarioName}' not found.`);
    return;
  }

  let fullContext = `# Context Assembly: ${scenarioName.toUpperCase()}\n`;
  if (scenario.description) fullContext += `> ${scenario.description}\n\n`;
  if (scenario.instructions)
    fullContext += `**Instructions**: ${scenario.instructions}\n\n`;

  // Process Includes
  for (const item of scenario.include) {
    const itemPath = path.join(process.cwd(), item);

    // If it's a directory (naive check for now, assuming ending in / or has wildcard)
    // For simplicity in this shell script version, we will handle specific files
    if (fs.existsSync(itemPath)) {
      const stat = fs.statSync(itemPath);
      if (stat.isFile()) {
        fullContext += `\n--- FILE: ${item} ---\n`;
        fullContext += fs.readFileSync(itemPath, 'utf8') + '\n';
      } else if (stat.isDirectory()) {
        fullContext += `\n--- DIR: ${item} (Summary) ---\n`;
        fullContext += fs.readdirSync(itemPath).join('\n') + '\n';
      }
    } else {
      fullContext += `\n--- MISSING: ${item} ---\n`;
    }
  }

  console.log(fullContext);
  // Optionally save to a .context/active.md
  const activeFile = path.join(
    process.cwd(),
    '.cline',
    'context',
    'ACTIVE_CONTEXT.md'
  );
  fs.writeFileSync(activeFile, fullContext);
  console.log(`\n>> Full Context saved to: ${activeFile}`);
}

async function listOrchestrationModes() {
  if (!fs.existsSync(KILO_MODES_FILE)) {
    console.log('No Kilo Code modes found.');
    return;
  }
  const content = fs.readFileSync(KILO_MODES_FILE, 'utf8');
  const modes = parseKiloModes(content);

  console.log('Available Orchestration Modes:');
  modes.forEach((mode) => {
    console.log(`- ${mode.slug}: ${mode.name}`);
  });
  console.log('\nTo use a mode: task cline_cli.suggest AGENT_MODE=<slug>');
}

async function suggestFromPlan() {
  if (!fs.existsSync(PLAN_FILE)) {
    console.log('No plan.md found.');
    return;
  }
  const content = fs.readFileSync(PLAN_FILE, 'utf8');
  console.log('Orchestration Plan Suggestion (Based on plan.md):');
  console.log('------------------------------------------------');

  const lines = content.split('\n');
  let found = false;
  for (const line of lines) {
    if (line.trim().startsWith('- [ ]')) {
      console.log('Next Task: ' + line.replace('- [ ]', '').trim());
      found = true;
      break;
    }
  }
  if (!found) console.log('No pending tasks found in plan.md.');
}

async function generateSuggestion(phase, context, agentMode) {
  const suggestions = [];

  // 1. Get Kilo Code Mode specific instructions
  if (agentMode && fs.existsSync(KILO_MODES_FILE)) {
    validatePath(KILO_MODES_FILE);
    const kiloContent = fs.readFileSync(KILO_MODES_FILE, 'utf8');
    const modes = parseKiloModes(kiloContent);
    const modeData = modes.find((m) => m.slug === agentMode);

    if (modeData) {
      suggestions.push({
        type: 'Agent Identity',
        content: `You are acting as ${modeData.name}.`,
        priority: 'high',
      });
      if (modeData.roleDefinition) {
        suggestions.push({
          type: 'Role Definition',
          content: modeData.roleDefinition.trim(),
          priority: 'high',
        });
      }
      if (modeData.customInstructions) {
        suggestions.push({
          type: 'Custom Instructions',
          content: modeData.customInstructions.trim(),
          priority: 'high',
        });
      }
    } else {
      suggestions.push({
        type: 'Warning',
        content: `Agent mode '${agentMode}' not found in Kilo configurations.`,
        priority: 'medium',
      });
    }
  }

  // 2. Get Phase specific suggestions (Original Logic - Updated path)
  // Check phases dir first
  const phaseMap = {
    setup: 'setup-configuration.md',
    architecture: 'architecture-planning.md',
    implementation: 'reusable.md',
    testing: 'reusable.md',
    deployment: 'reusable.md',
  };

  const fileName = phaseMap[phase] || 'reusable.md';
  const phasesDir = path.join(PROMPTS_DIR, 'phases');
  const filePath = path.join(phasesDir, fileName);

  // Fallback to legacy root if not found in phases
  const legacyPath = path.join(PROMPTS_DIR, fileName);

  let targetPath = fs.existsSync(filePath) ? filePath : legacyPath;

  if (fs.existsSync(targetPath)) {
    validatePath(targetPath);
    const content = fs.readFileSync(targetPath, 'utf8');
    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      if (line.startsWith('#')) {
        currentSection = line.replace(/#+\s*/, '').trim();
      } else if (line.trim().startsWith('-')) {
        suggestions.push({
          type: currentSection || 'General Phase Task',
          content: line.replace(/^-\s*/, '').trim(),
          priority: 'medium',
        });
      }
    }
  }

  // Filter if context is provided
  let filteredSuggestions = suggestions;
  if (context && context !== 'general') {
    const keywords = context.toLowerCase().split('-');
    const specific = suggestions.filter((s) =>
      keywords.some(
        (k) =>
          s.content.toLowerCase().includes(k) ||
          s.type.toLowerCase().includes(k)
      )
    );
    // Always keep high priority agent instructions
    const highPriority = suggestions.filter((s) => s.priority === 'high');
    if (specific.length > 0) {
      filteredSuggestions = [...highPriority, ...specific];
      filteredSuggestions = filteredSuggestions.filter(
        (v, i, a) => a.findIndex((t) => t.content === v.content) === i
      );
    }
  }

  return {
    phase,
    context: context || 'general',
    agentMode: agentMode || 'default',
    source: fileName,
    suggestions: filteredSuggestions.slice(0, 10), // Return top 10
  };
}

main();
