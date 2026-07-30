#!/usr/bin/env node
/**
 * Self-hosted CI overlay — disable script
 *
 * Reverts to GitHub-hosted runners by unsetting the repository variable.
 * Composite actions remain in the repo; they are no-ops when the profile is github-hosted.
 */

function main() {
  console.log("🛑 Disabling Atlas self-hosted CI overlay\n");
  console.log("Next steps:");
  console.log("1. In GitHub → Settings → Secrets and variables → Actions → Variables:");
  console.log("     Delete ATLAS_CI_RUNNER_PROFILE, or set it to github-hosted");
  console.log("2. Confirm the next workflow run uses ubuntu-latest in the Actions UI.\n");
  console.log("📖 See docs/how-we-build/ci.md for details.\n");
}

main();
