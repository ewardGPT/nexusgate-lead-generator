#!/usr/bin/env node

/**
 * validate-workflow.js
 * 
 * Validates the n8n workflow JSON file for:
 * - Valid JSON syntax
 * - Required node types presence
 * - Valid connection references
 * - Workflow settings
 * 
 * Usage: node scripts/validate-workflow.js
 */

const fs = require('fs');
const path = require('path');

const WORKFLOW_FILE = path.join(__dirname, '..', 'workflows', 'nexusgate-lead-generator.json');

// ANSI color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function validateJsonSyntax(filePath) {
  log('\n=== Validating JSON Syntax ===', 'cyan');

  if (!fs.existsSync(filePath)) {
    log(`❌ Workflow file not found: ${filePath}`, 'red');
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const workflow = JSON.parse(content);
    log(`✅ Valid JSON syntax: ${path.basename(filePath)}`, 'green');
    return workflow;
  } catch (err) {
    log(`❌ Invalid JSON: ${err.message}`, 'red');
    process.exit(1);
  }
}

function checkRequiredNodes(workflow) {
  log('\n=== Checking Required Node Types ===', 'cyan');

  const nodes = workflow.nodes || [];
  const nodeTypes = nodes.map(n => n.type || '');
  const nodeNames = nodes.map(n => n.name || 'Unnamed');

  log(`Found ${nodes.length} nodes:`, 'bold');
  nodeNames.forEach(name => log(`  - ${name}`));

  const requiredTypes = [
    { type: 'n8n-nodes-base.webhook', description: 'Webhook trigger' },
    { type: 'n8n-nodes-base.set', description: 'Data normalization' },
    { type: 'n8n-nodes-base.switch', description: 'Lead routing' },
    { type: 'n8n-nodes-base.code', description: 'Custom logic' },
  ];

  const missing = [];
  for (const { type, description } of requiredTypes) {
    const found = nodeTypes.some(nt => nt.includes(type.split('.')[1] || type));
    if (!found) {
      missing.push({ type, description });
    } else {
      log(`✅ ${description} (${type})`, 'green');
    }
  }

  if (missing.length > 0) {
    log('\n❌ Missing required node types:', 'red');
    missing.forEach(({ type, description }) => {
      log(`  - ${description}: ${type}`, 'red');
    });
    process.exit(1);
  }

  log('\n✅ All required node types present', 'green');
}

function validateConnections(workflow) {
  log('\n=== Validating Workflow Connections ===', 'cyan');

  const connections = workflow.connections || {};
  const nodes = workflow.nodes || [];
  const nodeNames = new Set(nodes.map(n => n.name));

  const errors = [];

  for (const [sourceNode, sourceConnections] of Object.entries(connections)) {
    if (!nodeNames.has(sourceNode)) {
      errors.push(`Source node "${sourceNode}" not found in nodes list`);
      continue;
    }

    for (const [outputIndex, outputs] of Object.entries(sourceConnections)) {
      for (const output of outputs) {
        const targetName = output.node;
        if (targetName && !nodeNames.has(targetName)) {
          errors.push(`Target node "${targetName}" not found (from ${sourceNode})`);
        }
      }
    }
  }

  if (errors.length > 0) {
    log('Connection errors found:', 'red');
    errors.forEach(err => log(`  ❌ ${err}`, 'red'));
    process.exit(1);
  }

  log('✅ All connections reference valid nodes', 'green');
}

function validateSettings(workflow) {
  log('\n=== Validating Workflow Settings ===', 'cyan');

  const settings = workflow.settings || {};
  const name = workflow.name || '';

  if (name) {
    log(`✅ Workflow name: ${name}`, 'green');
  } else {
    log('❌ Workflow has no name', 'red');
    process.exit(1);
  }

  const timeout = settings.executionTimeout;
  if (timeout) {
    log(`✅ Execution timeout set: ${timeout}s`, 'green');
  } else {
    log('⚠️ No execution timeout set (recommended: 300s)', 'yellow');
  }

  if (settings.saveManualExecutions) {
    log('✅ Manual execution saving enabled', 'green');
  }

  log('\n✅ Workflow settings validation passed', 'green');
}

function checkA_BTesting(workflow) {
  log('\n=== Checking A/B Testing Setup ===', 'cyan');

  const nodes = workflow.nodes || [];
  const abTestNode = nodes.find(n =>
    n.name?.toLowerCase().includes('a/b') ||
    n.name?.toLowerCase().includes('ab test')
  );

  if (abTestNode) {
    log(`✅ A/B testing node found: ${abTestNode.name}`, 'green');

    // Check for both variant scoring nodes
    const variantA = nodes.find(n => n.name?.includes('Variant A'));
    const variantB = nodes.find(n => n.name?.includes('Variant B'));

    if (variantA && variantB) {
      log(`✅ Variant A node: ${variantA.name}`, 'green');
      log(`✅ Variant B node: ${variantB.name}`, 'green');
    } else {
      log('⚠️ A/B test node exists but variant scoring nodes may be missing', 'yellow');
    }
  } else {
    log('⚠️ No A/B testing node found (optional but recommended)', 'yellow');
  }
}

// ============================================================
// Main
// ============================================================
function main() {
  log('\n' + '='.repeat(50), 'bold');
  log('  NexusGate Workflow Validator', 'bold');
  log('='.repeat(50), 'bold');

  const workflow = validateJsonSyntax(WORKFLOW_FILE);
  checkRequiredNodes(workflow);
  validateConnections(workflow);
  validateSettings(workflow);
  checkA_BTesting(workflow);

  log('\n' + '='.repeat(50), 'bold');
  log('  ✅ All validations passed!', 'green');
  log('='.repeat(50) + '\n', 'bold');
}

main();
