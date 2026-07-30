#!/usr/bin/env node
/**
 * Performance Budgets Module - Disable Script
 *
 * Removes workflow files from .github/workflows/.
 */

const fs = require("fs");
const path = require("path");

const WORKFLOWS_DIR = path.join(__dirname, "..", "..", ".github", "workflows");

const WORKFLOWS = ["perf-lighthouse.yml", "perf-bundle.yml"];

function removeWorkflow(filename) {
  const filepath = path.join(WORKFLOWS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    console.log(`Workflow not found: ${filename} (already disabled)`);
    return true;
  }

  fs.unlinkSync(filepath);
  console.log(`Disabled workflow: ${filename}`);
  return true;
}

function main() {
  console.log("Disabling performance budgets module\n");

  let success = true;
  for (const workflow of WORKFLOWS) {
    if (!removeWorkflow(workflow)) {
      success = false;
    }
  }

  if (success) {
    console.log("\nPerformance budgets module disabled.\n");
    console.log("Configuration files and dependencies remain in place.");
    console.log("To re-enable, run: pnpm perf:enable");
  } else {
    console.error("\nFailed to disable performance budgets module");
    process.exit(1);
  }
}

main();
