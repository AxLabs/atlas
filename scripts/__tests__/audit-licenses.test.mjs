import assert from "node:assert/strict";
import { test } from "node:test";

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
