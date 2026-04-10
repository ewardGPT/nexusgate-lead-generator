#!/usr/bin/env node

/**
 * analyze-scoring-prompts.js
 * 
 * Compares the two OpenClaw scoring prompt variants (A and B)
 * from the n8n workflow JSON and outputs a side-by-side analysis.
 * 
 * Usage: node scripts/analyze-scoring-prompts.js
 */

const fs = require('fs');
const path = require('path');

const WORKFLOW_FILE = path.join(__dirname, '..', 'workflows', 'nexusgate-lead-generator.json');

function loadWorkflow() {
  try {
    const content = fs.readFileSync(WORKFLOW_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to load workflow: ${err.message}`);
    process.exit(1);
  }
}

function findScoringNodes(workflow) {
  const nodes = workflow.nodes || [];

  const variantA = nodes.find(n =>
    n.name?.includes('Variant A') || n.name?.includes('Score Lead (A)')
  );

  const variantB = nodes.find(n =>
    n.name?.includes('Variant B') || n.name?.includes('Score Lead (B)')
  );

  return { variantA, variantB };
}

function extractPrompt(node) {
  if (!node) return null;

  const messages = node.parameters?.prompt?.messages || [];
  const userMessage = messages.find(m => m.role === 'user');
  return userMessage?.content || null;
}

function analyzePrompt(prompt, label) {
  if (!prompt) {
    console.log(`\n${label}: No prompt found`);
    return null;
  }

  const analysis = {
    length: prompt.length,
    wordCount: prompt.split(/\s+/).length,
    hasRubric: /rubric|scoring|score \d|0-10|0–10/i.test(prompt),
    hasICP: /ICP|ideal customer|ideal profile/i.test(prompt),
    hasNonICP: /non-icp|non-ICP|score low|disqualif/i.test(prompt),
    hasExamples: /example|such as|e\.g\./i.test(prompt),
    hasOutputFormat: /return.*json|output.*format|this format/i.test(prompt),
    hasTemperature: /temperature|tone|style|guideline/i.test(prompt),
    sections: (prompt.match(/\n\n/g) || []).length + 1,
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label} Analysis`);
  console.log('='.repeat(60));
  console.log(`  Length:        ${analysis.length} characters`);
  console.log(`  Word count:    ${analysis.wordCount} words`);
  console.log(`  Sections:      ${analysis.sections}`);
  console.log(`  Has rubric:    ${analysis.hasRubric ? '✅' : '❌'}`);
  console.log(`  Has ICP:       ${analysis.hasICP ? '✅' : '❌'}`);
  console.log(`  Has Non-ICP:   ${analysis.hasNonICP ? '✅' : '❌'}`);
  console.log(`  Has examples:  ${analysis.hasExamples ? '✅' : '❌'}`);
  console.log(`  Output format: ${analysis.hasOutputFormat ? '✅' : '❌'}`);
  console.log(`  Has tone guide:${analysis.hasTemperature ? '✅' : '❌'}`);

  return analysis;
}

function compareAnalysis(a, b) {
  if (!a || !b) return;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Comparison Summary`);
  console.log('='.repeat(60));

  const diffs = [];
  if (a.length !== b.length) {
    const diff = b.length - a.length;
    diffs.push(`Variant B is ${diff > 0 ? '+' : ''}${diff} characters ${diff > 0 ? 'longer' : 'shorter'}`);
  }
  if (a.wordCount !== b.wordCount) {
    const diff = b.wordCount - a.wordCount;
    diffs.push(`Variant B has ${diff > 0 ? '+' : ''}${diff} words`);
  }
  if (a.sections !== b.sections) {
    diffs.push(`Variant A has ${a.sections} sections, Variant B has ${b.sections}`);
  }

  const featuresA = [a.hasRubric, a.hasICP, a.hasNonICP, a.hasExamples, a.hasOutputFormat, a.hasTemperature].filter(Boolean).length;
  const featuresB = [b.hasRubric, b.hasICP, b.hasNonICP, b.hasExamples, b.hasOutputFormat, b.hasTemperature].filter(Boolean).length;

  console.log(`  Variant A features: ${featuresA}/6`);
  console.log(`  Variant B features: ${featuresB}/6`);
  console.log(`  More detailed: ${featuresB > featuresA ? 'Variant B' : featuresA > featuresB ? 'Variant A' : 'Equal'}`);

  if (diffs.length > 0) {
    console.log(`\n  Differences:`);
    diffs.forEach(d => console.log(`    - ${d}`));
  }
}

function main() {
  console.log('\n🔍 NexusGate Scoring Prompt Analyzer\n');

  const workflow = loadWorkflow();
  const { variantA, variantB } = findScoringNodes(workflow);

  if (!variantA && !variantB) {
    console.log('❌ No scoring variant nodes found in workflow.');
    console.log('   Expected nodes named "OpenClaw — Score Lead (Variant A)" and "(Variant B)"');
    process.exit(1);
  }

  const promptA = extractPrompt(variantA);
  const promptB = extractPrompt(variantB);

  const analysisA = analyzePrompt(promptA, 'Variant A');
  const analysisB = analyzePrompt(promptB, 'Variant B');

  compareAnalysis(analysisA, analysisB);

  console.log('\n💡 Tip: Track conversion rates per variant in Google Sheets');
  console.log('   to determine which scoring prompt produces better leads.\n');
}

main();
