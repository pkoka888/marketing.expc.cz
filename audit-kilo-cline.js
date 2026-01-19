import fs from 'fs';

// Simple YAML parser if js-yaml is not available (likely environment restriction)
function parseYaml(content) {
  const lines = content.split('\n');
  const modes = [];
  let currentMode = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('slug:')) {
      if (currentMode) modes.push(currentMode);
      currentMode = { slug: line.split('slug:')[1].trim() };
    } else if (line.includes('name:') && currentMode) {
      currentMode.name = line.split('name:')[1].trim();
    } else if (line.includes('description:') && currentMode) {
      currentMode.description = line.split('description:')[1].trim();
    }
  }
  if (currentMode) modes.push(currentMode);
  return { customModes: modes };
}

const KILO_FILE = '.kilocodemodes';
const CONDUCTOR_FILE = '.cline/workflows/agent-orchestration.json';

async function audit() {
  console.log('Starting Audit...');

  if (!fs.existsSync(KILO_FILE)) {
    console.error('❌ .kilocodemodes missing!');
    return;
  }
  if (!fs.existsSync(CONDUCTOR_FILE)) {
    console.error('❌ agent-orchestration.json missing!');
    return;
  }

  const kiloContent = fs.readFileSync(KILO_FILE, 'utf8');
  const kiloModes = parseYaml(kiloContent).customModes;

  const conductorContent = fs.readFileSync(CONDUCTOR_FILE, 'utf8');
  const conductorModes = JSON.parse(conductorContent).modes;

  console.log(`\nFound ${kiloModes.length} Kilo Code modes.`);
  console.log(`Found ${Object.keys(conductorModes).length} Conductor modes.`);

  let discrepancies = 0;

  // Check Kilo -> Conductor
  kiloModes.forEach((kMode) => {
    const cMode = conductorModes[kMode.slug];
    if (!cMode) {
      console.log(
        `⚠️  Mode '${kMode.slug}' exists in Kilo Code but NOT in Conductor.`
      );
      discrepancies++;
    } else {
      if (cMode.name !== kMode.name) {
        console.log(
          `⚠️  Name mismatch for '${kMode.slug}': Kilo='${kMode.name}', Conductor='${cMode.name}'`
        );
        discrepancies++;
      }
    }
  });

  // Check Conductor -> Kilo
  Object.keys(conductorModes).forEach((slug) => {
    const kMode = kiloModes.find((m) => m.slug === slug);
    if (!kMode) {
      console.log(
        `⚠️  Mode '${slug}' exists in Conductor but NOT in Kilo Code.`
      );
      discrepancies++;
    }
  });

  if (discrepancies === 0) {
    console.log(
      '\n✅ Modes are effectively synchronized (slugs and names match).'
    );
  } else {
    console.log(`\n❌ Found ${discrepancies} discrepancies.`);
  }
}

audit();
