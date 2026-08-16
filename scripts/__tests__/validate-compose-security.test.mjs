import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  findInsecureDevServiceBindings,
  validateComposeSecurity,
} from "../validate-compose-security.mjs";

describe("findInsecureDevServiceBindings", () => {
  it("flags ports published on all interfaces", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "compose-security-"));
    const filePath = path.join(dir, "infra.yml");
    writeFileSync(
      filePath,
      `services:
  postgres:
    ports:
      - "5432:5432"
  redis:
    ports:
      - "127.0.0.1:6379:6379"
`,
    );

    const insecure = findInsecureDevServiceBindings(filePath);
    assert.equal(insecure.length, 1);
    assert.equal(insecure[0]?.service, "postgres");
    assert.equal(insecure[0]?.port, "5432:5432");
  });

  it("accepts loopback-only bindings", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "compose-security-"));
    const filePath = path.join(dir, "infra.yml");
    writeFileSync(
      filePath,
      `services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"
`,
    );

    assert.equal(findInsecureDevServiceBindings(filePath).length, 0);
  });
});

describe("validateComposeSecurity", () => {
  it("passes for the Atlas infrastructure example", () => {
    assert.doesNotThrow(() => validateComposeSecurity());
  });
});
