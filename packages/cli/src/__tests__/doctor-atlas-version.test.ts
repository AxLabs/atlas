import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createDoctorContext } from "../doctor/context";
import { DoctorDiagnosticCode } from "../doctor/diagnostics";
import { runAtlasVersionCheck } from "../doctor/checks";
import { readCheckoutAtlasVersion, readCliAtlasVersion } from "../version";

describe("generated project Atlas version identity", () => {
  it("resolves 0.3.0 from baseline when the app version is 0.1.0 and the CLI is 0.3.0", () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-generated-version-"));
    writeFileSync(
      path.join(repoRoot, "package.json"),
      `${JSON.stringify({ name: "consumer-app", version: "0.1.0" }, null, 2)}\n`,
      "utf8"
    );
    writeFileSync(
      path.join(repoRoot, "atlas.config.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          platform: {
            baseline: {
              atlasVersion: "0.3.0",
              contractSchemaVersion: 1,
              templateManifestSchemaVersion: 1,
              syncedPathChecksums: {},
            },
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    expect(readCheckoutAtlasVersion(repoRoot)).toBe("0.3.0");

    const result = runAtlasVersionCheck({
      repoRoot,
      atlasVersion: "0.3.0",
      checkoutAtlasVersion: readCheckoutAtlasVersion(repoRoot),
      rawContract: {
        schemaVersion: 1,
        platform: {
          baseline: {
            atlasVersion: "0.3.0",
            contractSchemaVersion: 1,
            templateManifestSchemaVersion: 1,
            syncedPathChecksums: {},
          },
        },
      },
    });

    expect(result.status).toBe("pass");
    expect(result.diagnostics).toEqual([]);
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it("does not report a Doctor mismatch for a generated project whose baseline matches the installed CLI", () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-generated-doctor-version-"));
    const cliVersion = readCliAtlasVersion();
    writeFileSync(
      path.join(repoRoot, "package.json"),
      `${JSON.stringify({ name: "consumer-app", version: "0.1.0" }, null, 2)}\n`,
      "utf8"
    );
    writeFileSync(
      path.join(repoRoot, "atlas.config.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          platform: {
            baseline: {
              atlasVersion: cliVersion,
              contractSchemaVersion: 1,
              templateManifestSchemaVersion: 1,
              syncedPathChecksums: {},
            },
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const context = createDoctorContext({ cwd: repoRoot });
    expect(context.checkoutAtlasVersion).toBe(cliVersion);
    expect(context.checkoutAtlasVersion).not.toBe("0.1.0");

    const result = runAtlasVersionCheck(context);
    expect(result.status).toBe("pass");
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === DoctorDiagnosticCode.VERSION_MISMATCH
      )
    ).toBe(false);
    rmSync(repoRoot, { recursive: true, force: true });
  });
});
