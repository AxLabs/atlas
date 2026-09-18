#!/usr/bin/env node
/**
 * Self-hosted CI overlay — enable script
 *
 * Atlas ships with a portable CI workflow on ubuntu-latest. Teams with their own
 * runner fleet can enable persistent pnpm/Turbo caches and self-hosted labels
 * by setting a repository variable (no workflow file replacement required).
 */

const fs = require("fs");
const path = require("path");

const ACTIONS_DIR = path.join(__dirname, "..", "..", ".github", "actions");
const TEMPLATES_DIR = path.join(__dirname, "templates");

const ACTIONS = ["cleanup-self-hosted-job"];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
}

function copyAction(name) {
  const src = path.join(TEMPLATES_DIR, name, "action.yml");
  const destDir = path.join(ACTIONS_DIR, name);
  const dest = path.join(destDir, "action.yml");

  if (!fs.existsSync(src)) {
    console.error(`✗ Template not found: ${src}`);
    return false;
  }

  ensureDir(destDir);

  if (fs.existsSync(dest)) {
    console.log(`⚠ Action already exists: ${name} (skipping copy)`);
    return true;
  }

  fs.copyFileSync(src, dest);
  console.log(`✓ Installed action: ${name}`);
  return true;
}

function main() {
  console.log("🚀 Enabling Atlas self-hosted CI overlay\n");

  let success = true;
  for (const action of ACTIONS) {
    if (!copyAction(action)) {
      success = false;
    }
  }

  if (!success) {
    console.error("\n❌ Failed to enable self-hosted CI overlay");
    process.exit(1);
  }

  console.log("\n✅ Self-hosted CI overlay files are in place.\n");
  console.log("Next steps:");
  console.log("1. Bootstrap each runner host:");
  console.log("     sudo mkdir -p /var/cache/ci");
  console.log("     sudo chown -R <runner-user>:<runner-user> /var/cache/ci");
  console.log("2. Register runners in the Blitzcraft Trusted CI runner group with label: ci");
  console.log("3. Allowlist this workflow on the runner group:");
  console.log(
    "     blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@refs/heads/main"
  );
  console.log("4. In GitHub → Settings → Secrets and variables → Actions → Variables:");
  console.log("     Name:  ATLAS_CI_RUNNER_PROFILE");
  console.log("     Value: self-hosted");
  console.log("     Optional:");
  console.log("     Name:  ATLAS_CI_RUNNER_GROUP");
  console.log(
    "     Value: Blitzcraft Trusted CI  (optional; leave unset to use the workflow default)"
  );
  console.log("5. Push a branch and confirm trusted jobs schedule on your runners.\n");
  console.log("📖 See docs/how-we-build/ci.md for full documentation.\n");
  console.log("To revert: pnpm ci:self-hosted:disable and delete the repository variable.\n");
}

main();
