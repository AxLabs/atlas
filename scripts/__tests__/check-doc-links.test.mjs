import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkDocumentationLinks,
  decodeLinkTarget,
  extractHeadingSlugs,
  extractLinkTargets,
  isCanonicalDoc,
  normalizeRepoPath,
  resolveInternalLink,
  slugifyHeading,
  stripCodeLiterals,
  validateInternalLink,
} from "../check-doc-links.mjs";

test("decodeLinkTarget handles spaces and URL encoding", () => {
  assert.deepEqual(decodeLinkTarget("docs/public/My%20Doc.md#section-one"), {
    kind: "internal",
    filePart: "docs/public/My Doc.md",
    fragment: "section-one",
  });
});

test("slugifyHeading matches common GitHub-style anchors", () => {
  assert.equal(slugifyHeading("Why custom theming instead of next-themes?"), "why-custom-theming-instead-of-next-themes");
});

test("isCanonicalDoc identifies public and how-we-build surfaces", () => {
  assert.equal(isCanonicalDoc("docs/public/faq.md"), true);
  assert.equal(isCanonicalDoc("docs/how-we-build/testing.md"), true);
  assert.equal(isCanonicalDoc("docs/audit/claims-register.md"), false);
  assert.equal(isCanonicalDoc("docs/_archive/2025-12-pre-platform-docs/README.md"), false);
});

test("validateInternalLink flags canonical links into archive", () => {
  const source = path.join(process.cwd(), "docs/public/faq.md");
  const issues = validateInternalLink({
    sourceFile: source,
    parsed: { kind: "internal", filePart: "../_archive/2025-12-pre-platform-docs/README.md", fragment: "" },
  });
  assert.equal(issues[0]?.type, "archive-policy");
});

test("validateInternalLink detects missing files and fragments", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-doc-links-"));
  const source = path.join(tmp, "docs/public/source.md");
  const target = path.join(tmp, "docs/public/target.md");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(source, "[link](./target.md#missing)\n");
  fs.writeFileSync(target, "# Present heading\n");

  const missingFile = validateInternalLink({
    sourceFile: source,
    parsed: { kind: "internal", filePart: "./missing.md", fragment: "" },
  });
  assert.equal(missingFile[0]?.type, "missing-file");

  const missingFragment = validateInternalLink({
    sourceFile: source,
    parsed: { kind: "internal", filePart: "./target.md", fragment: "missing" },
  });
  assert.equal(missingFragment[0]?.type, "missing-fragment");

  const resolved = resolveInternalLink(source, "./target.md");
  assert.equal(normalizeRepoPath(path.relative(tmp, resolved)), "docs/public/target.md");
});

test("resolveInternalLink supports repository-root absolute paths", () => {
  const source = path.join(process.cwd(), "README.md");
  const resolved = resolveInternalLink(source, "/docs/public/faq.md");
  assert.equal(normalizeRepoPath(path.relative(process.cwd(), resolved)), "docs/public/faq.md");
});

test("checkDocumentationLinks scans maintained documentation surfaces", () => {
  const result = checkDocumentationLinks();
  assert.ok(result.scannedFiles >= 20);
  assert.equal(result.issues.length, 0);
});
