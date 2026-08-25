#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPlatformBaseline,
  captureSyncedPathChecksumsStrict,
  LATEST_SCHEMA_VERSION,
} from "../dist/index.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const manifestPath = path.join(repoRoot, "templates/app-infrastructure.manifest.json");
const contractPath = path.join(repoRoot, "atlas.config.json");
const packageJsonPath = path.join(repoRoot, "package.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

const syncedPathChecksums = captureSyncedPathChecksumsStrict({
  repoRoot,
  applicationRoot: "apps/web",
  syncedPaths: manifest.syncedPaths,
});

contract.platform = {
  baseline: buildPlatformBaseline({
    atlasVersion: packageJson.version,
    contractSchemaVersion: LATEST_SCHEMA_VERSION,
    templateManifestSchemaVersion: manifest.schemaVersion,
    syncedPathChecksums,
  }),
};

writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
