import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createDoctorContext } from "../doctor/context";
import { DoctorDiagnosticCode } from "../doctor/diagnostics";
import { runUpgradeBaselineCheck } from "../doctor/upgrade-baseline";

describe("doctor upgrade baseline", () => {
  it("warns when platform.baseline is missing", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-doctor-baseline-"));
    writeFileSync(
      path.join(tempRoot, "package.json"),
      `${JSON.stringify({ name: "@atlas/monorepo", version: "0.1.0" }, null, 2)}\n`
    );
    writeFileSync(
      path.join(tempRoot, "atlas.config.json"),
      `${JSON.stringify({ schemaVersion: 1 }, null, 2)}\n`
    );
    mkdirSync(path.join(tempRoot, "apps/web/src/features"), { recursive: true });
    mkdirSync(path.join(tempRoot, "packages/ui"), { recursive: true });
    writeFileSync(
      path.join(tempRoot, "packages/ui/package.json"),
      `${JSON.stringify({ name: "@atlas/ui" }, null, 2)}\n`
    );
    mkdirSync(path.join(tempRoot, "openapi"), { recursive: true });
    mkdirSync(path.join(tempRoot, "apps/web/src/lib/api/contracts"), { recursive: true });
    writeFileSync(path.join(tempRoot, "openapi/openapi.json"), "{}\n");
    writeFileSync(path.join(tempRoot, "apps/web/src/lib/api/contracts/schema.ts"), "export {};\n");

    const context = createDoctorContext({ cwd: tempRoot });
    const result = runUpgradeBaselineCheck(context);
    expect(result.status).toBe("warn");
    expect(result.diagnostics[0]?.code).toBe(DoctorDiagnosticCode.UPGRADE_BASELINE_MISSING);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
