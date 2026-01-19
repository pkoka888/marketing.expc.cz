#!/usr/bin/env node

/**
 * Test script for /prompt-advisor functionality
 */

import PromptAdvisor from './prompt-advisor.js';

async function testPromptAdvisor() {
  console.log('🧪 Testing /prompt-advisor functionality...\n');

  const advisor = new PromptAdvisor();

  try {
    // Test 1: Help command
    console.log('📋 Test 1: Help command');
    await advisor.handleCommand(['help']);
    console.log('');

    // Test 2: Next steps
    console.log('🎯 Test 2: Next steps');
    await advisor.handleCommand(['next-steps']);
    console.log('');

    // Test 3: Architecture phase
    console.log('🏗️ Test 3: Architecture phase suggestions');
    await advisor.handleCommand(['architecture-phase']);
    console.log('');

    // Test 4: CI/CD setup
    console.log('⚙️ Test 4: CI/CD setup suggestions');
    await advisor.handleCommand(['ci-cd-setup']);
    console.log('');

    // Test 5: Agent mode specific
    console.log('🤖 Test 5: Agent mode specific suggestions');
    await advisor.handleCommand(['agent-mode', '--agent=frontend-engineer']);
    console.log('');

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testPromptAdvisor();
}

export default testPromptAdvisor;