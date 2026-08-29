#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_REPO_ROOT } from "./security-audit-policy.mjs";

const scriptPath = fileURLToPath(import.meta.url);

function parseLockfilePackages(lockfile) {
  const packages = [];
  const lines = lockfile.split(/\r?\n/);
  let inPackages = false;

  for (const line of lines) {
    if (line === "packages:") {
      inPackages = true;
      continue;
    }
    if (!inPackages) {
      continue;
    }
    if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
      break;
    }
    const match = line.match(
      /^ {2}(?:'|")?(@?(?:[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?))@([^'":\s]+)(?:'|")?:/,
    );
    if (!match) {
      continue;
    }
    const name = match[1];
    const version = match[2];
    if (version.startsWith("link:") || version.startsWith("file:")) {
      continue;
    }
    packages.push({ name, version });
  }

  return packages;
}

export function validateSpdxDocument(document) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return ["SBOM is not a JSON object"];
  }
  if (typeof document.spdxVersion !== "string" || !document.spdxVersion.startsWith("SPDX-")) {
    errors.push("SBOM is missing spdxVersion");
  }
  if (typeof document.SPDXID !== "string") {
    errors.push("SBOM is missing SPDXID");
  }
  if (typeof document.name !== "string" || document.name.trim().length === 0) {
    errors.push("SBOM is missing name");
  }
  if (!Array.isArray(document.packages) || document.packages.length === 0) {
    errors.push("SBOM packages must be a non-empty array");
  } else {
    const withoutName = document.packages.filter((pkg) => !pkg?.name);
    if (withoutName.length > 0) {
      errors.push("SBOM packages are missing name fields");
    }
  }
  return errors;
}

export function generateSpdxSbom({
  root = DEFAULT_REPO_ROOT,
  commitSha = process.env.GITHUB_SHA || "unknown",
  createdAt = new Date().toISOString(),
} = {}) {
  const lockfilePath = path.join(root, "pnpm-lock.yaml");
  const lockfile = readFileSync(lockfilePath, "utf8");
  const packages = parseLockfilePackages(lockfile);
  if (packages.length === 0) {
    throw new Error("SBOM generation found no packages in pnpm-lock.yaml");
  }

  const documentNamespace = `https://github.com/blitzcraftlabs/atlas/sbom/${commitSha}`;
  const spdx = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `atlas-${commitSha}`,
    documentNamespace,
    creationInfo: {
      created: createdAt,
      creators: ["Tool: atlas-sbom-generator"],
    },
    packages: packages.map((pkg) => {
      const id = createHash("sha256").update(`${pkg.name}@${pkg.version}`).digest("hex").slice(0, 16);
      return {
        SPDXID: `SPDXRef-Package-${id}`,
        name: pkg.name,
        versionInfo: pkg.version,
        downloadLocation: "NOASSERTION",
        filesAnalyzed: false,
      };
    }),
  };

  const errors = validateSpdxDocument(spdx);
  if (errors.length > 0) {
    throw new Error(`Generated SBOM is invalid: ${errors.join("; ")}`);
  }

  return spdx;
}

function parseArgs(argv) {
  const options = { output: null, root: DEFAULT_REPO_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output") {
      options.output = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--root") {
      options.root = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const spdx = generateSpdxSbom({ root: options.root });
  const output =
    options.output ||
    path.join(options.root, "artifacts", `atlas-sbom-${process.env.GITHUB_SHA || "local"}.spdx.json`);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(spdx, null, 2)}\n`);
  process.stdout.write(`✓ Wrote SPDX SBOM with ${spdx.packages.length} packages to ${output}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main();
}
