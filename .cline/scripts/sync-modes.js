import fs from 'fs';
import path from 'path';
import { readJsonSafe, writeJsonSafe } from './utils/safe-fs.js';

const KILO_MODES_FILE = path.join(process.cwd(), '.kilocode', 'modes.yaml');
const ORCHESTRATION_FILE = path.join(
  process.cwd(),
  '.cline',
  'workflows',
  'agent-orchestration.json'
);

// Simple YAML parser (same as in local-suggest.js)
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

async function sync() {
  console.log('Syncing .kilocode/modes.yaml -> agent-orchestration.json ...');

  if (!fs.existsSync(KILO_MODES_FILE)) {
    console.error('Source file missing: .kilocode/modes.yaml');
    return;
  }

  const kiloContent = fs.readFileSync(KILO_MODES_FILE, 'utf8');
  const kiloModes = parseKiloModes(kiloContent);

  let orchestration = await readJsonSafe(ORCHESTRATION_FILE);
  if (!orchestration) orchestration = { modes: {} };

  let updates = 0;

  kiloModes.forEach((kMode) => {
    const slug = kMode.slug;
    if (!orchestration.modes[slug]) {
      orchestration.modes[slug] = {
        id: slug,
        name: kMode.name,
        description: kMode.roleDefinition.trim(),
        // Default values for fields not in simple Kilo mode
        purpose: `Role: ${kMode.name}`,
        whenToUse: [kMode.roleDefinition.trim()],
      };
      console.log(`+ Added mode: ${slug}`);
      updates++;
    } else {
      // Update details if description changed
      if (
        orchestration.modes[slug].description !== kMode.roleDefinition.trim()
      ) {
        orchestration.modes[slug].description = kMode.roleDefinition.trim();
        updates++;
      }
    }
  });

  if (updates > 0) {
    await writeJsonSafe(ORCHESTRATION_FILE, orchestration);
    console.log(`✅ Synced ${updates} changes.`);
  } else {
    console.log('✅ Already in sync.');
  }
}

sync();
