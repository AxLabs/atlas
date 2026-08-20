import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { createGeneratorAtlasFixture } from "./fixture";

export interface DoctorAtlasFixture {
  root: string;
  cleanup: () => void;
}

export interface DoctorFixtureOptions {
  withContract?: boolean;
  invalidContract?: boolean;
  unsupportedContract?: boolean;
  structurallyInvalidContract?: boolean;
  openApi?: boolean;
  withApplicationTooling?: boolean;
  withViolation?: DoctorViolationKind;
}

export type DoctorViolationKind =
  | "private-import"
  | "direct-env"
  | "raw-fetch"
  | "reference-import"
  | "cross-feature-import"
  | "undeclared-dependency"
  | "stale-openapi";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");

export function createDoctorAtlasFixture(options?: DoctorFixtureOptions): DoctorAtlasFixture {
  if (options?.unsupportedContract) {
    return createContractFixture({
      contract: { schemaVersion: 99 },
    });
  }

  if (options?.invalidContract) {
    return createContractFixture({ invalidJson: true });
  }

  if (options?.structurallyInvalidContract) {
    return createGeneratorAtlasFixture({ structurallyInvalidContract: true });
  }

  const fixture = createGeneratorAtlasFixture({
    withContract: options?.withContract ?? true,
    openApi: options?.openApi ?? false,
  });

  writeFileSync(
    path.join(fixture.root, "pnpm-workspace.yaml"),
    'packages:\n  - "apps/*"\n  - "packages/*"\n',
    "utf8"
  );

  writeFileSync(
    path.join(fixture.root, "apps/web/package.json"),
    `${JSON.stringify(
      {
        name: "@atlas/web",
        version: "0.1.0",
        private: true,
        dependencies: {
          "@atlas/ui": "workspace:*",
        },
        devDependencies: {
          eslint: "9.17.0",
          typescript: "5.7.2",
          "openapi-typescript": "7.10.1",
        },
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  mkdirSync(path.join(fixture.root, "apps/web/src"), { recursive: true });

  if (options?.withApplicationTooling ?? true) {
    copyApplicationDoctorTooling(fixture.root);
  }

  if (options?.openApi) {
    seedOpenApiArtifacts(fixture.root, options.withViolation === "stale-openapi");
  }

  if (options?.withViolation) {
    applyDoctorViolation(fixture.root, options.withViolation);
  }

  return fixture;
}

function createContractFixture(options: {
  contract?: Record<string, unknown>;
  invalidJson?: boolean;
  missing?: boolean;
}): DoctorAtlasFixture {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-doctor-fixture-"));
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "@atlas/monorepo", version: "0.1.0", private: true }, null, 2)}\n`,
    "utf8"
  );

  if (!options.missing) {
    const contractPath = path.join(root, "atlas.config.json");
    if (options.invalidJson) {
      writeFileSync(contractPath, "{ invalid", "utf8");
    } else {
      writeFileSync(
        contractPath,
        `${JSON.stringify(options.contract ?? { schemaVersion: 1 }, null, 2)}\n`,
        "utf8"
      );
    }
  }

  return { root, cleanup: () => undefined };
}

function copyApplicationDoctorTooling(fixtureRoot: string): void {
  const sourceAppRoot = path.join(REPO_ROOT, "apps/web");
  const targetAppRoot = path.join(fixtureRoot, "apps/web");

  for (const fileName of ["eslint.config.mjs", "architecture-policy.mjs", "tsconfig.json"]) {
    copyFileSync(path.join(sourceAppRoot, fileName), path.join(targetAppRoot, fileName));
  }

  cpSync(
    path.join(sourceAppRoot, "src/components/eslint-boundaries"),
    path.join(targetAppRoot, "src/components/eslint-boundaries"),
    {
      recursive: true,
    }
  );

  linkIfAbsent(path.join(REPO_ROOT, "node_modules"), path.join(fixtureRoot, "node_modules"));
  linkIfAbsent(path.join(sourceAppRoot, "node_modules"), path.join(targetAppRoot, "node_modules"));
  linkIfAbsent(path.join(REPO_ROOT, "packages/ui"), path.join(fixtureRoot, "packages/ui"));
}

function linkIfAbsent(source: string, target: string): void {
  if (existsSync(target)) {
    return;
  }

  symlinkSync(source, target, "dir");
}

function seedOpenApiArtifacts(fixtureRoot: string, stale: boolean): void {
  const specSource = path.join(REPO_ROOT, "openapi/openapi.json");
  const schemaSource = path.join(REPO_ROOT, "apps/web/src/lib/api/contracts/schema.ts");
  const specTarget = path.join(fixtureRoot, "openapi/openapi.json");
  const schemaTarget = path.join(fixtureRoot, "apps/web/src/lib/api/contracts/schema.ts");

  mkdirSync(path.dirname(specTarget), { recursive: true });
  mkdirSync(path.dirname(schemaTarget), { recursive: true });
  copyFileSync(specSource, specTarget);
  copyFileSync(schemaSource, schemaTarget);

  writeFileSync(
    path.join(fixtureRoot, "atlas.config.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        capabilities: { openApi: true },
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  if (stale) {
    writeFileSync(schemaTarget, "// stale generated artifact\n", "utf8");
  }
}

function applyDoctorViolation(fixtureRoot: string, violation: DoctorViolationKind): void {
  switch (violation) {
    case "private-import":
      writeViolationFile(
        fixtureRoot,
        "apps/web/src/features/billing/example.ts",
        "import { Button } from '../../../../../packages/ui/src/components/ui/button';\nvoid Button;\n"
      );
      break;
    case "direct-env":
      writeViolationFile(
        fixtureRoot,
        "apps/web/src/features/billing/env.ts",
        "export const apiUrl = process.env.NEXT_PUBLIC_API_URL;\n"
      );
      break;
    case "raw-fetch":
      writeViolationFile(
        fixtureRoot,
        "apps/web/src/features/billing/network.ts",
        "export async function load() { return fetch('/api/example'); }\n"
      );
      break;
    case "reference-import":
      mkdirSync(path.join(fixtureRoot, "apps/web/src/features/reference/users"), {
        recursive: true,
      });
      writeFileSync(
        path.join(fixtureRoot, "apps/web/src/features/reference/users/index.ts"),
        "export const reference = true;\n",
        "utf8"
      );
      writeViolationFile(
        fixtureRoot,
        "apps/web/src/features/billing/reference.ts",
        "import { userKeys } from '@/features/reference/users';\nvoid userKeys;\n"
      );
      break;
    case "cross-feature-import":
      mkdirSync(path.join(fixtureRoot, "apps/web/src/features/users"), { recursive: true });
      writeFileSync(
        path.join(fixtureRoot, "apps/web/src/features/users/index.ts"),
        "export const users = true;\n",
        "utf8"
      );
      writeViolationFile(
        fixtureRoot,
        "apps/web/src/features/billing/cross.ts",
        "import { users } from '@/features/users';\nvoid users;\n"
      );
      break;
    case "undeclared-dependency":
      writeViolationFile(
        fixtureRoot,
        "apps/web/src/features/billing/undeclared.ts",
        "import { z } from 'zod';\nexport const schema = z.object({ id: z.string() });\n"
      );
      break;
    default:
      break;
  }
}

function writeViolationFile(fixtureRoot: string, relativePath: string, contents: string): void {
  const absolutePath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
}

export function snapshotFixtureTree(fixtureRoot: string): Record<string, string> {
  const files: Record<string, string> = {};

  function walk(relativePath: string): void {
    if (relativePath.split("/").includes("node_modules")) {
      return;
    }

    const absolutePath = path.join(fixtureRoot, relativePath);
    for (const entry of readdirSync(absolutePath)) {
      if (entry === "node_modules") {
        continue;
      }

      const nextRelative = path.join(relativePath, entry);
      const nextAbsolute = path.join(fixtureRoot, nextRelative);
      const stats = statSync(nextAbsolute);
      if (stats.isDirectory()) {
        walk(nextRelative);
        continue;
      }

      files[nextRelative.replace(/\\/g, "/")] = readFileSync(nextAbsolute, "utf8");
    }
  }

  if (existsSync(fixtureRoot)) {
    walk(".");
  }

  return files;
}

export function createMissingContractFixture(): DoctorAtlasFixture {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-doctor-missing-contract-"));
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "@atlas/monorepo", version: "0.1.0", private: true }, null, 2)}\n`,
    "utf8"
  );
  mkdirSync(path.join(root, "apps/web"), { recursive: true });
  mkdirSync(path.join(root, "packages/ui"), { recursive: true });
  return { root, cleanup: () => undefined };
}
