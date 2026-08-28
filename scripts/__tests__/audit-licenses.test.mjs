import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  enumerateInstalledPackages,
  loadExceptionsFile,
  runLicenseAudit,
  summarizePackages,
} from "../audit-licenses.mjs";
import {
  EXPECTED_LICENSE_AUDIT_CPU,
  EXPECTED_LICENSE_AUDIT_OS,
  assertLicenseAuditArchitectures,
  readLicenseAuditArchitectures,
} from "../license-audit-config.mjs";
import {
  requiresEffectiveLicenseEvidence,
  validateExceptionEntry,
  validateExceptions,
} from "../license-exceptions.mjs";
import {
  classifyLicenseExpression,
  classifySingleLicense,
  normalizeLicenseField,
} from "../license-policy.mjs";

test("classifies known allowed licenses", () => {
  assert.equal(classifySingleLicense("MIT"), "allowed");
  assert.equal(classifySingleLicense("Apache-2.0"), "allowed");
  assert.equal(classifyLicenseExpression("MIT OR Apache-2.0"), "allowed");
});

test("classifies unknown licenses", () => {
  assert.equal(classifySingleLicense("Custom-Enterprise-1.0"), "unknown");
  assert.equal(classifyLicenseExpression(""), "unknown");
});

test("classifies review-required licenses", () => {
  assert.equal(classifySingleLicense("MPL-2.0"), "review-required");
  assert.equal(classifyLicenseExpression("SEE LICENSE IN LICENSE"), "review-required");
});

test("classifies multi-license expressions conservatively", () => {
  assert.equal(classifyLicenseExpression("(MIT AND BSD-3-Clause)"), "allowed");
  assert.equal(classifyLicenseExpression("MIT OR GPL-3.0"), "disallowed");
  assert.equal(classifyLicenseExpression("BSD-2-Clause OR MIT"), "allowed");
});

test("normalizes legacy license objects and missing metadata", () => {
  assert.equal(normalizeLicenseField({ type: "MIT" }), "MIT");
  assert.equal(normalizeLicenseField(undefined, [{ type: "MIT" }]), "MIT");
  assert.equal(normalizeLicenseField("  "), null);
  assert.equal(normalizeLicenseField(undefined), null);
});

test("pnpm-workspace.yaml defines deterministic license audit architectures", () => {
  const { os, cpu } = readLicenseAuditArchitectures();
  assert.deepEqual([...os].sort(), [...EXPECTED_LICENSE_AUDIT_OS].sort());
  assert.deepEqual([...cpu].sort(), [...EXPECTED_LICENSE_AUDIT_CPU].sort());
  assert.doesNotMatch(os.join(","), /current/);
  assertLicenseAuditArchitectures();
});

test("requires effective license evidence for missing or nonstandard manifest licenses", () => {
  assert.equal(requiresEffectiveLicenseEvidence(null), true);
  assert.equal(requiresEffectiveLicenseEvidence("SEE LICENSE IN LICENSE"), true);
  assert.equal(requiresEffectiveLicenseEvidence("MIT"), false);
});

test("valid reviewed exception passes validation", () => {
  const errors = validateExceptionEntry(
    "example@1.0.0",
    {
      status: "reviewed",
      reason: "Reviewed transitive dependency.",
      reviewedOn: "2026-08-27",
    },
    { package: { license: "MIT" } },
  );
  assert.deepEqual(errors, []);
});

test("empty exception object fails validation", () => {
  const errors = validateExceptionEntry("example@1.0.0", {});
  assert.ok(errors.some((error) => error.includes('status must be "reviewed"')));
  assert.ok(errors.some((error) => error.includes("reason must be a non-empty string")));
  assert.ok(errors.some((error) => error.includes("reviewedOn must be a valid YYYY-MM-DD date")));
});

test("wrong exception status fails validation", () => {
  const errors = validateExceptionEntry("example@1.0.0", {
    status: "approved",
    reason: "Looks fine.",
    reviewedOn: "2026-08-27",
  });
  assert.ok(errors.some((error) => error.includes('status must be "reviewed"')));
});

test("missing or empty exception reason fails validation", () => {
  assert.ok(
    validateExceptionEntry("example@1.0.0", {
      status: "reviewed",
      reviewedOn: "2026-08-27",
    }).some((error) => error.includes("reason must be a non-empty string")),
  );
  assert.ok(
    validateExceptionEntry("example@1.0.0", {
      status: "reviewed",
      reason: "   ",
      reviewedOn: "2026-08-27",
    }).some((error) => error.includes("reason must be a non-empty string")),
  );
});

test("invalid reviewedOn values fail validation", () => {
  for (const reviewedOn of ["27-08-2026", "yesterday", "2026-99-99"]) {
    const errors = validateExceptionEntry("example@1.0.0", {
      status: "reviewed",
      reason: "Reviewed.",
      reviewedOn,
    });
    assert.ok(errors.some((error) => error.includes("reviewedOn must be a valid YYYY-MM-DD date")));
  }
});

test("missing-license resolution without evidence fails validation", () => {
  const errors = validateExceptionEntry(
    "browser-assert@1.2.1",
    {
      status: "reviewed",
      effectiveLicense: "MIT",
      reason: "Manifest omits license field.",
      reviewedOn: "2026-08-27",
    },
    { package: { license: null } },
  );
  assert.ok(errors.some((error) => error.includes("source is required")));
});

test("valid missing-license resolution passes validation", () => {
  const errors = validateExceptionEntry(
    "browser-assert@1.2.1",
    {
      status: "reviewed",
      effectiveLicense: "MIT",
      source: "node_modules/browser-assert/LICENSE",
      reason: "Manifest omits license field; package LICENSE file is MIT.",
      reviewedOn: "2026-08-27",
    },
    { package: { license: null } },
  );
  assert.deepEqual(errors, []);
});

test("stale exception fails validation", () => {
  const packagesByKey = new Map([["present@1.0.0", { name: "present", version: "1.0.0" }]]);
  const errors = validateExceptions(
    {
      "present@1.0.0": {
        status: "reviewed",
        reason: "Still present.",
        reviewedOn: "2026-08-27",
      },
      "missing@9.9.9": {
        status: "reviewed",
        reason: "No longer installed.",
        reviewedOn: "2026-08-27",
      },
    },
    packagesByKey,
  );
  assert.ok(errors.some((error) => error.includes("missing@9.9.9")));
  assert.ok(errors.some((error) => error.includes("stale")));
});

test("invalid exception cannot bypass disallowed license policy", () => {
  const packages = [
    {
      name: "blocked-package",
      version: "1.0.0",
      license: "GPL-3.0",
      path: "/tmp/blocked-package",
    },
  ];
  const summary = summarizePackages(packages, {
    "blocked-package@1.0.0": {},
  });
  const errors = validateExceptions(
    { "blocked-package@1.0.0": {} },
    new Map([["blocked-package@1.0.0", packages[0]]]),
  );

  assert.equal(summary.disallowed.length, 0);
  assert.equal(summary.reviewed.length, 1);
  assert.ok(errors.length > 0);
});

test("runLicenseAudit validates repository license-exceptions.json against installed packages", () => {
  const audit = runLicenseAudit({ reportOnly: true });
  assert.equal(audit.exceptionErrors.length, 0);
  assert.ok(audit.packages.length > 0);
});

test("enumerateInstalledPackages includes non-host platform optional dependencies", () => {
  const packages = enumerateInstalledPackages();
  const names = new Set(packages.map((pkg) => pkg.name));

  assert.ok(
    names.has("@img/sharp-libvips-darwin-arm64") || names.has("@img/sharp-libvips-darwin-x64"),
    "expected darwin sharp optional dependency in audit universe",
  );
  assert.ok(
    names.has("@img/sharp-libvips-linux-x64") || names.has("@img/sharp-libvips-linux-arm64"),
    "expected linux sharp optional dependency in audit universe",
  );
});

test("repository license-exceptions.json matches installed packages", () => {
  const packages = enumerateInstalledPackages();
  const packagesByKey = new Map(packages.map((pkg) => [`${pkg.name}@${pkg.version}`, pkg]));
  const errors = validateExceptions(loadExceptionsFile(), packagesByKey);
  assert.deepEqual(errors, []);
});

function createTempAuditFixture({ exceptions, packages }) {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-license-audit-"));
  mkdirSync(path.join(root, "node_modules", "sample"), { recursive: true });
  writeFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    `packages:
  - "apps/*"
  - "packages/*"

supportedArchitectures:
  os:
    - linux
    - darwin
  cpu:
    - x64
    - arm64
`,
    "utf8",
  );

  for (const pkg of packages) {
    const packageDir = path.join(root, "node_modules", pkg.name.replace("/", path.sep));
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      path.join(packageDir, "package.json"),
      `${JSON.stringify(
        {
          name: pkg.name,
          version: pkg.version,
          license: pkg.license,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  writeFileSync(
    path.join(root, "license-exceptions.json"),
    `${JSON.stringify({ exceptions }, null, 2)}\n`,
    "utf8",
  );

  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("runLicenseAudit fails on malformed exceptions in temp fixture", () => {
  const fixture = createTempAuditFixture({
    packages: [{ name: "sample", version: "1.0.0", license: "MIT" }],
    exceptions: {
      "sample@1.0.0": {},
    },
  });

  try {
    const audit = runLicenseAudit({ root: fixture.root, reportOnly: true });
    assert.ok(audit.exceptionErrors.length > 0);
  } finally {
    fixture.cleanup();
  }
});
