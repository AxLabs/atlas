import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  buildInventoryRecords,
  buildJsonReport,
  enumerateInstalledPackages,
  loadExceptionsFile,
  runLicenseAudit,
  summarizeInventory,
  summarizePackages,
} from "../audit-licenses.mjs";
import {
  EXPECTED_LICENSE_AUDIT_CPU,
  EXPECTED_LICENSE_AUDIT_OS,
  assertLicenseAuditArchitectures,
  readLicenseAuditArchitectures,
} from "../license-audit-config.mjs";
import {
  isNonRegistryDependencySpec,
  isAtlasWorkspaceLink,
} from "../dependency-sources.mjs";
import {
  requiresEffectiveLicenseEvidence,
  resolvePackageLicenseRecord,
  validateExceptionEntry,
  validateExceptionEvidenceSource,
  validateExceptions,
  validatePackageException,
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

test("normalizes legacy licenses array conservatively with AND", () => {
  assert.equal(
    normalizeLicenseField(undefined, [{ type: "MIT" }, { type: "GPL-3.0" }]),
    "MIT AND GPL-3.0",
  );
  assert.equal(classifyLicenseExpression("MIT AND GPL-3.0"), "disallowed");
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
      disposition: "accepted",
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
    disposition: "accepted",
    reason: "Looks fine.",
    reviewedOn: "2026-08-27",
  });
  assert.ok(errors.some((error) => error.includes('status must be "reviewed"')));
});

test("missing or empty exception reason fails validation", () => {
  assert.ok(
    validateExceptionEntry("example@1.0.0", {
      status: "reviewed",
      disposition: "accepted",
      reviewedOn: "2026-08-27",
    }).some((error) => error.includes("reason must be a non-empty string")),
  );
});

test("invalid reviewedOn values fail validation", () => {
  for (const reviewedOn of ["27-08-2026", "yesterday", "2026-99-99"]) {
    const errors = validateExceptionEntry("example@1.0.0", {
      status: "reviewed",
      disposition: "accepted",
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
      disposition: "accepted",
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
      disposition: "accepted",
      effectiveLicense: "MIT",
      source: "node_modules/browser-assert/LICENSE",
      reason: "Manifest omits license field; package LICENSE file is MIT.",
      reviewedOn: "2026-08-27",
    },
    { package: { license: null } },
  );
  assert.deepEqual(errors, []);
});

function createEvidenceFixture({ source, packageName = "browser-assert", version = "1.2.1" }) {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-license-evidence-"));
  const packageDir = path.join(root, "node_modules", packageName);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({ name: packageName, version, license: null }, null, 2)}\n`,
    "utf8",
  );

  if (source) {
    const evidencePath = path.join(root, source);
    mkdirSync(path.dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, "MIT License\n", "utf8");
  }

  return {
    root,
    pkg: {
      name: packageName,
      version,
      license: null,
      path: packageDir,
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("valid existing evidence file passes filesystem validation", () => {
  const fixture = createEvidenceFixture({
    source: "node_modules/browser-assert/LICENSE",
  });

  try {
    const errors = validateExceptionEvidenceSource(
      "browser-assert@1.2.1",
      {
        status: "reviewed",
        disposition: "accepted",
        effectiveLicense: "MIT",
        source: "node_modules/browser-assert/LICENSE",
        reason: "MIT per LICENSE file.",
        reviewedOn: "2026-08-27",
      },
      { package: fixture.pkg, repoRoot: fixture.root },
    );
    assert.deepEqual(errors, []);
  } finally {
    fixture.cleanup();
  }
});

test("nonexistent evidence file fails filesystem validation", () => {
  const fixture = createEvidenceFixture({ source: null });

  try {
    const errors = validateExceptionEvidenceSource(
      "browser-assert@1.2.1",
      {
        status: "reviewed",
        disposition: "accepted",
        effectiveLicense: "MIT",
        source: "node_modules/browser-assert/LICENSE",
        reason: "MIT per LICENSE file.",
        reviewedOn: "2026-08-27",
      },
      { package: fixture.pkg, repoRoot: fixture.root },
    );
    assert.ok(errors.some((error) => error.includes("does not exist")));
  } finally {
    fixture.cleanup();
  }
});

test("typo in evidence filename fails filesystem validation", () => {
  const fixture = createEvidenceFixture({
    source: "node_modules/browser-assert/LICENSE",
  });

  try {
    const errors = validateExceptionEvidenceSource(
      "browser-assert@1.2.1",
      {
        status: "reviewed",
        disposition: "accepted",
        effectiveLicense: "MIT",
        source: "node_modules/browser-assert/LICNESE",
        reason: "MIT per LICENSE file.",
        reviewedOn: "2026-08-27",
      },
      { package: fixture.pkg, repoRoot: fixture.root },
    );
    assert.ok(errors.some((error) => error.includes("does not exist")));
  } finally {
    fixture.cleanup();
  }
});

test("evidence path escaping repository root fails filesystem validation", () => {
  const fixture = createEvidenceFixture({
    source: "node_modules/browser-assert/LICENSE",
  });

  try {
    const errors = validateExceptionEvidenceSource(
      "browser-assert@1.2.1",
      {
        status: "reviewed",
        disposition: "accepted",
        effectiveLicense: "MIT",
        source: "../../outside/LICENSE",
        reason: "MIT per LICENSE file.",
        reviewedOn: "2026-08-27",
      },
      { package: fixture.pkg, repoRoot: fixture.root },
    );
    assert.ok(errors.some((error) => error.includes("escapes the repository root")));
  } finally {
    fixture.cleanup();
  }
});

test("unrelated package evidence fails filesystem validation", () => {
  const fixture = createEvidenceFixture({
    source: "node_modules/react/LICENSE",
    packageName: "browser-assert",
  });

  try {
    const errors = validateExceptionEvidenceSource(
      "browser-assert@1.2.1",
      {
        status: "reviewed",
        disposition: "accepted",
        effectiveLicense: "MIT",
        source: "node_modules/react/LICENSE",
        reason: "MIT per LICENSE file.",
        reviewedOn: "2026-08-27",
      },
      { package: fixture.pkg, repoRoot: fixture.root },
    );
    assert.ok(errors.some((error) => error.includes("node_modules/browser-assert/")));
  } finally {
    fixture.cleanup();
  }
});

test("unknown plus effective GPL remains disallowed", () => {
  const errors = validateExceptionEntry(
    "bad@1.0.0",
    {
      status: "reviewed",
      disposition: "accepted",
      effectiveLicense: "GPL-3.0",
      source: "node_modules/bad/LICENSE",
      reason: "Attempted override.",
      reviewedOn: "2026-08-27",
    },
    { package: { license: null } },
  );
  assert.ok(errors.some((error) => error.includes("effectiveLicense is disallowed")));
});

test("disallowed GPL cannot be accepted by generic review exception", () => {
  const errors = validateExceptionEntry(
    "blocked@1.0.0",
    {
      status: "reviewed",
      disposition: "accepted",
      reason: "Looks fine.",
      reviewedOn: "2026-08-27",
    },
    { package: { license: "GPL-3.0" } },
  );
  assert.ok(errors.some((error) => error.includes("cannot be overridden")));
});

test("review-required without disposition fails validation", () => {
  const errors = validateExceptionEntry(
    "mpl@1.0.0",
    {
      status: "reviewed",
      reason: "Reviewed.",
      reviewedOn: "2026-08-27",
    },
    { package: { license: "MPL-2.0" } },
  );
  assert.ok(errors.some((error) => error.includes('disposition must be "accepted"')));
});

test("stale exception fails validation", () => {
  const packagesByKey = new Map([["present@1.0.0", { name: "present", version: "1.0.0" }]]);
  const errors = validateExceptions(
    {
      "present@1.0.0": {
        status: "reviewed",
        disposition: "accepted",
        reason: "Still present.",
        reviewedOn: "2026-08-27",
      },
      "missing@9.9.9": {
        status: "reviewed",
        disposition: "accepted",
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
    "blocked-package@1.0.0": {
      status: "reviewed",
      disposition: "accepted",
      reason: "Should not work.",
      reviewedOn: "2026-08-27",
    },
  });
  const errors = validateExceptions(
    {
      "blocked-package@1.0.0": {
        status: "reviewed",
        disposition: "accepted",
        reason: "Should not work.",
        reviewedOn: "2026-08-27",
      },
    },
    new Map([["blocked-package@1.0.0", packages[0]]]),
  );

  assert.equal(summary.disallowed.length, 1);
  assert.equal(summary.reviewed.length, 0);
  assert.ok(errors.length > 0);
  assert.equal(summary.disallowed[0].declaredClassification, "disallowed");
});

test("unknown plus effective MIT is accepted when properly evidenced", () => {
  const record = resolvePackageLicenseRecord(
    { name: "browser-assert", version: "1.2.1", license: null },
    {
      status: "reviewed",
      disposition: "accepted",
      effectiveLicense: "MIT",
      source: "node_modules/browser-assert/LICENSE",
      reason: "MIT per LICENSE file.",
      reviewedOn: "2026-08-27",
    },
    [],
  );

  assert.equal(record.declaredLicense, null);
  assert.equal(record.declaredClassification, "unknown");
  assert.equal(record.effectiveLicense, "MIT");
  assert.equal(record.effectiveClassification, "allowed");
  assert.equal(record.disposition, "accepted");
});

test("review-required MPL keeps declared classification when accepted", () => {
  const record = resolvePackageLicenseRecord(
    { name: "axe-core", version: "4.11.0", license: "MPL-2.0" },
    {
      status: "reviewed",
      disposition: "accepted",
      reason: "Reviewed transitive dependency.",
      reviewedOn: "2026-08-27",
    },
    [],
  );

  assert.equal(record.declaredLicense, "MPL-2.0");
  assert.equal(record.declaredClassification, "review-required");
  assert.equal(record.disposition, "accepted");
  assert.equal(record.effectiveClassification, undefined);
});

test("disallowed GPL cannot be rewritten into allowed disposition", () => {
  const record = resolvePackageLicenseRecord(
    { name: "blocked-package", version: "1.0.0", license: "GPL-3.0" },
    {
      status: "reviewed",
      disposition: "accepted",
      reason: "Should not work.",
      reviewedOn: "2026-08-27",
    },
    [],
  );

  assert.equal(record.declaredClassification, "disallowed");
  assert.equal(record.disposition, undefined);
});

test("json report preserves declared and effective license evidence", () => {
  const fixture = createEvidenceFixture({
    source: "node_modules/browser-assert/LICENSE",
  });

  try {
    const packages = [
      fixture.pkg,
      { name: "axe-core", version: "4.11.0", license: "MPL-2.0" },
      { name: "blocked-package", version: "1.0.0", license: "GPL-3.0" },
    ];
    const exceptions = {
      "browser-assert@1.2.1": {
        status: "reviewed",
        disposition: "accepted",
        effectiveLicense: "MIT",
        source: "node_modules/browser-assert/LICENSE",
        reason: "MIT per LICENSE file.",
        reviewedOn: "2026-08-27",
      },
      "axe-core@4.11.0": {
        status: "reviewed",
        disposition: "accepted",
        reason: "Reviewed transitive dependency.",
        reviewedOn: "2026-08-27",
      },
    };
    const records = buildInventoryRecords(packages, exceptions, { repoRoot: fixture.root });
    const summary = summarizeInventory(records);
    const report = buildJsonReport({ packages, exceptions, records, summary });

    const browserAssert = report.packages.find((pkg) => pkg.name === "browser-assert");
    assert.deepEqual(browserAssert, {
      name: "browser-assert",
      version: "1.2.1",
      declaredLicense: null,
      declaredClassification: "unknown",
      effectiveLicense: "MIT",
      effectiveClassification: "allowed",
      disposition: "accepted",
      exception: {
        status: "reviewed",
        reason: "MIT per LICENSE file.",
        reviewedOn: "2026-08-27",
        effectiveLicense: "MIT",
        source: "node_modules/browser-assert/LICENSE",
        disposition: "accepted",
      },
    });

    const axeCore = report.packages.find((pkg) => pkg.name === "axe-core");
    assert.equal(axeCore.declaredClassification, "review-required");
    assert.equal(axeCore.disposition, "accepted");
    assert.equal(axeCore.effectiveClassification, undefined);

    const blocked = report.packages.find((pkg) => pkg.name === "blocked-package");
    assert.equal(blocked.declaredClassification, "disallowed");
    assert.equal(blocked.disposition, undefined);
  } finally {
    fixture.cleanup();
  }
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
  const errors = validateExceptions(loadExceptionsFile(), packagesByKey, {
    repoRoot: process.cwd(),
  });
  assert.deepEqual(errors, []);
});

test("inventory records are deterministically sorted", () => {
  const packages = [
    { name: "zebra", version: "1.0.0", license: "MIT" },
    { name: "alpha", version: "2.0.0", license: "MIT" },
    { name: "alpha", version: "1.0.0", license: "MIT" },
  ];
  const records = buildInventoryRecords(packages, {});
  assert.deepEqual(
    records.map((record) => `${record.name}@${record.version}`),
    ["alpha@1.0.0", "alpha@2.0.0", "zebra@1.0.0"],
  );
});

test("json report schema includes stable package records", () => {
  const packages = [{ name: "sample", version: "1.0.0", license: "MIT" }];
  const records = buildInventoryRecords(packages, {});
  const summary = summarizePackages(packages, {});
  const report = buildJsonReport({ packages, exceptions: {}, records, summary });

  assert.equal(report.schemaVersion, "1");
  assert.equal(report.packages.length, 1);
  assert.equal(report.packages[0].declaredClassification, "allowed");
  assert.equal(report.packages[0].name, "sample");
});

test("non-registry dependency specs are detected", () => {
  assert.equal(isAtlasWorkspaceLink("@atlas/ui", "workspace:*"), true);
  assert.equal(isNonRegistryDependencySpec("workspace:*"), true);
  assert.equal(isNonRegistryDependencySpec("github:foo/bar"), true);
  assert.equal(isNonRegistryDependencySpec("git+https://example.com/repo.git"), true);
  assert.equal(isNonRegistryDependencySpec("^1.0.0"), false);
});

function createMissingLicenseExceptionFixture({
  evidenceSource,
  writeEvidenceFile = false,
  packageName = "example",
  version = "1.0.0",
}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-license-exception-audit-"));
  const packageDir = path.join(root, "node_modules", packageName);
  mkdirSync(packageDir, { recursive: true });
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
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({ name: packageName, version, license: null }, null, 2)}\n`,
    "utf8",
  );

  const source = evidenceSource ?? `node_modules/${packageName}/DOES-NOT-EXIST`;
  if (writeEvidenceFile) {
    const evidencePath = path.join(root, source);
    mkdirSync(path.dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, "MIT License\n", "utf8");
  }

  const exceptions = {
    [`${packageName}@${version}`]: {
      status: "reviewed",
      disposition: "accepted",
      effectiveLicense: "MIT",
      source,
      reason: "Reviewed.",
      reviewedOn: "2026-08-27",
    },
  };

  writeFileSync(
    path.join(root, "license-exceptions.json"),
    `${JSON.stringify({ exceptions }, null, 2)}\n`,
    "utf8",
  );

  return {
    root,
    packageName,
    version,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("invalid evidence cannot become accepted inventory record", () => {
  const fixture = createMissingLicenseExceptionFixture({
    evidenceSource: "node_modules/example/DOES-NOT-EXIST",
  });

  try {
    const audit = runLicenseAudit({ root: fixture.root, reportOnly: true });
    const record = audit.records.find(
      (entry) => entry.name === fixture.packageName && entry.version === fixture.version,
    );

    assert.ok(record);
    assert.equal(record.declaredClassification, "unknown");
    assert.equal(record.disposition, undefined);
    assert.notEqual(record.disposition, "accepted");
    assert.notEqual(record.effectiveClassification, "allowed");
    assert.ok(audit.exceptionErrors.some((error) => error.includes("does not exist")));
  } finally {
    fixture.cleanup();
  }
});

test("invalid evidence is not counted as reviewed in summary", () => {
  const fixture = createMissingLicenseExceptionFixture({
    evidenceSource: "node_modules/example/DOES-NOT-EXIST",
  });

  try {
    const audit = runLicenseAudit({ root: fixture.root, reportOnly: true });
    assert.equal(audit.summary.reviewed.length, 0);
    assert.equal(audit.summary.unknown.length, 1);
  } finally {
    fixture.cleanup();
  }
});

test("json report does not represent invalid evidence as accepted", () => {
  const fixture = createMissingLicenseExceptionFixture({
    evidenceSource: "node_modules/example/DOES-NOT-EXIST",
  });

  try {
    const audit = runLicenseAudit({ root: fixture.root, reportOnly: true });
    const report = buildJsonReport({
      root: fixture.root,
      packages: audit.packages,
      exceptions: audit.exceptions,
      records: audit.records,
      summary: audit.summary,
    });
    const pkg = report.packages.find((entry) => entry.name === fixture.packageName);

    assert.ok(pkg);
    assert.notEqual(pkg.disposition, "accepted");
    assert.equal(pkg.declaredClassification, "unknown");
    assert.equal(report.summary.reviewed, 0);
    assert.equal(report.summary.unknown, 1);
  } finally {
    fixture.cleanup();
  }
});

test("valid evidence still yields accepted effective license in inventory", () => {
  const fixture = createMissingLicenseExceptionFixture({
    evidenceSource: "node_modules/example/LICENSE",
    writeEvidenceFile: true,
  });

  try {
    const audit = runLicenseAudit({ root: fixture.root, reportOnly: true });
    const record = audit.records.find(
      (entry) => entry.name === fixture.packageName && entry.version === fixture.version,
    );

    assert.ok(record);
    assert.equal(record.declaredClassification, "unknown");
    assert.equal(record.effectiveLicense, "MIT");
    assert.equal(record.effectiveClassification, "allowed");
    assert.equal(record.disposition, "accepted");
    assert.equal(audit.summary.reviewed.length, 1);
    assert.equal(audit.exceptionErrors.length, 0);
  } finally {
    fixture.cleanup();
  }
});

test("validatePackageException combines entry and evidence validation", () => {
  const fixture = createEvidenceFixture({ source: null });

  try {
    const errors = validatePackageException(
      "browser-assert@1.2.1",
      {
        status: "reviewed",
        disposition: "accepted",
        effectiveLicense: "MIT",
        source: "node_modules/browser-assert/LICENSE",
        reason: "MIT per LICENSE file.",
        reviewedOn: "2026-08-27",
      },
      fixture.pkg,
      fixture.root,
    );
    assert.ok(errors.some((error) => error.includes("does not exist")));
  } finally {
    fixture.cleanup();
  }
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

test("platform-specific optional dependency with disallowed license fails audit", () => {
  const fixture = createTempAuditFixture({
    packages: [
      { name: "sample", version: "1.0.0", license: "MIT" },
      {
        name: "@next/swc-darwin-arm64",
        version: "16.3.2",
        license: "GPL-3.0",
      },
    ],
    exceptions: {},
  });

  try {
    const audit = runLicenseAudit({ root: fixture.root, reportOnly: false });
    assert.ok(audit.summary.disallowed.length >= 1);
    assert.ok(
      audit.records.some(
        (record) =>
          record.name === "@next/swc-darwin-arm64" && record.declaredClassification === "disallowed",
      ),
    );
  } finally {
    fixture.cleanup();
  }
});

test("platform-specific optional dependency with unknown license fails audit", () => {
  const fixture = createTempAuditFixture({
    packages: [
      {
        name: "@img/sharp-libvips-darwin-arm64",
        version: "1.3.2",
        license: null,
      },
    ],
    exceptions: {},
  });

  try {
    const audit = runLicenseAudit({ root: fixture.root, reportOnly: false });
    assert.ok(audit.summary.unknown.length >= 1);
  } finally {
    fixture.cleanup();
  }
});
