import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runCurrentTreeProvenanceCheck } from "../provenance-audit.mjs";

function createProvenanceFixture(files) {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-provenance-fixture-"));

  const runGit = (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

  runGit(["init"]);
  runGit(["config", "user.email", "test@example.com"]);
  runGit(["config", "user.name", "Test User"]);
  runGit(["config", "commit.gpgsign", "false"]);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents);
  }

  runGit(["add", "."]);
  runGit(["commit", "-m", "fixture"]);

  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("provenance check passes on minimal valid fixture", () => {
  const fixture = createProvenanceFixture({
    LICENSE: "Apache License\nVersion 2.0\n",
    "THIRD_PARTY_NOTICES.md": "# notices\n",
    "docs/how-we-build/provenance.md": "# provenance\n",
    "reviewed-assets.json": '{"assets":{}}\n',
    "packages/ui/package.json": JSON.stringify({ name: "@atlas/ui", dependencies: {} }),
  });

  try {
    const errors = runCurrentTreeProvenanceCheck({ root: fixture.root });
    assert.deepEqual(errors, []);
  } finally {
    fixture.cleanup();
  }
});

test("provenance check fails when required notices are missing", () => {
  const fixture = createProvenanceFixture({
    LICENSE: "Apache License\nVersion 2.0\n",
    "packages/ui/package.json": JSON.stringify({ name: "@atlas/ui", dependencies: {} }),
  });

  try {
    const errors = runCurrentTreeProvenanceCheck({ root: fixture.root });
    assert.ok(errors.some((error) => error.includes("Missing provenance documentation")));
  } finally {
    fixture.cleanup();
  }
});

test("provenance check fails on unreviewed binary asset", () => {
  const fixture = createProvenanceFixture({
    LICENSE: "Apache License\nVersion 2.0\n",
    "THIRD_PARTY_NOTICES.md": "# notices\n",
    "docs/how-we-build/provenance.md": "# provenance\n",
    "reviewed-assets.json": '{"assets":{}}\n',
    "packages/ui/package.json": JSON.stringify({ name: "@atlas/ui", dependencies: {} }),
    "apps/web/public/logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  });

  try {
    const errors = runCurrentTreeProvenanceCheck({ root: fixture.root });
    assert.ok(errors.some((error) => error.includes("reviewed-assets.json")));
  } finally {
    fixture.cleanup();
  }
});

test("provenance check allows reviewed binary asset with matching hash", () => {
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const sha256 = createHash("sha256").update(pngBytes).digest("hex");

  const fixture = createProvenanceFixture({
    LICENSE: "Apache License\nVersion 2.0\n",
    "THIRD_PARTY_NOTICES.md": "# notices\n",
    "docs/how-we-build/provenance.md": "# provenance\n",
    "reviewed-assets.json": `${JSON.stringify(
      {
        assets: {
          "apps/web/public/logo.png": {
            sha256,
            origin: "Atlas-authored",
            license: "Apache-2.0",
            reason: "Fixture logo",
            reviewedOn: "2026-08-28",
          },
        },
      },
      null,
      2,
    )}\n`,
    "packages/ui/package.json": JSON.stringify({ name: "@atlas/ui", dependencies: {} }),
    "apps/web/public/logo.png": pngBytes,
  });

  try {
    const errors = runCurrentTreeProvenanceCheck({ root: fixture.root });
    assert.deepEqual(errors, []);
  } finally {
    fixture.cleanup();
  }
});

test("provenance check fails on stale reviewed asset entry", () => {
  const fixture = createProvenanceFixture({
    LICENSE: "Apache License\nVersion 2.0\n",
    "THIRD_PARTY_NOTICES.md": "# notices\n",
    "docs/how-we-build/provenance.md": "# provenance\n",
    "reviewed-assets.json": `${JSON.stringify(
      {
        assets: {
          "apps/web/public/old-logo.png": {
            sha256: "a".repeat(64),
            origin: "Atlas-authored",
            license: "Apache-2.0",
            reason: "Removed asset",
            reviewedOn: "2026-08-28",
          },
        },
      },
      null,
      2,
    )}\n`,
    "packages/ui/package.json": JSON.stringify({ name: "@atlas/ui", dependencies: {} }),
  });

  try {
    const errors = runCurrentTreeProvenanceCheck({ root: fixture.root });
    assert.ok(errors.some((error) => error.includes("Stale reviewed asset entry")));
  } finally {
    fixture.cleanup();
  }
});

test("provenance check fails on reviewed asset hash mismatch", () => {
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

  const fixture = createProvenanceFixture({
    LICENSE: "Apache License\nVersion 2.0\n",
    "THIRD_PARTY_NOTICES.md": "# notices\n",
    "docs/how-we-build/provenance.md": "# provenance\n",
    "reviewed-assets.json": `${JSON.stringify(
      {
        assets: {
          "apps/web/public/logo.png": {
            sha256: "b".repeat(64),
            origin: "Atlas-authored",
            license: "Apache-2.0",
            reason: "Fixture logo",
            reviewedOn: "2026-08-28",
          },
        },
      },
      null,
      2,
    )}\n`,
    "packages/ui/package.json": JSON.stringify({ name: "@atlas/ui", dependencies: {} }),
    "apps/web/public/logo.png": pngBytes,
  });

  try {
    const errors = runCurrentTreeProvenanceCheck({ root: fixture.root });
    assert.ok(errors.some((error) => error.includes("hash mismatch")));
  } finally {
    fixture.cleanup();
  }
});

test("provenance check fails on stale radix declaration", () => {
  const fixture = createProvenanceFixture({
    LICENSE: "Apache License\nVersion 2.0\n",
    "THIRD_PARTY_NOTICES.md": "# notices\n",
    "docs/how-we-build/provenance.md": "# provenance\n",
    "reviewed-assets.json": '{"assets":{}}\n',
    "packages/ui/package.json": JSON.stringify({
      name: "@atlas/ui",
      dependencies: { "@radix-ui/react-dialog": "1.0.0" },
    }),
  });

  try {
    const errors = runCurrentTreeProvenanceCheck({ root: fixture.root });
    assert.ok(errors.some((error) => error.includes("@radix-ui/react-dialog")));
  } finally {
    fixture.cleanup();
  }
});
