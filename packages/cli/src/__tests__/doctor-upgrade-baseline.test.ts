import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { computeBaselineChecksum } from "@atlas/project";

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

  it("fails when baseline is missing manifest synced path checksums", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-doctor-baseline-incomplete-"));
    const manifest = JSON.parse(
      readFileSync(
        path.resolve(__dirname, "../../../../templates/app-infrastructure.manifest.json"),
        "utf8"
      )
    );

    writeFileSync(
      path.join(tempRoot, "package.json"),
      `${JSON.stringify({ name: "@atlas/monorepo", version: "0.1.0" }, null, 2)}\n`
    );
    mkdirSync(path.join(tempRoot, "templates"), { recursive: true });
    writeFileSync(
      path.join(tempRoot, "templates/app-infrastructure.manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    writeFileSync(
      path.join(tempRoot, "atlas.config.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          platform: {
            baseline: {
              atlasVersion: "0.1.0",
              contractSchemaVersion: 1,
              templateManifestSchemaVersion: 1,
              syncedPathChecksums: {
                "src/lib/api/client.ts": computeBaselineChecksum("client"),
              },
            },
          },
        },
        null,
        2
      )}\n`
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
    expect(result.status).toBe("fail");
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === DoctorDiagnosticCode.UPGRADE_BASELINE_INCOMPLETE
      )
    ).toBe(true);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
