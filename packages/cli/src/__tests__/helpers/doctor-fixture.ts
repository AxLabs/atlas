import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
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
  customProductFeaturesRoot?: string;
  externalProductFeaturesRoot?: string;
  checkoutVersion?: string;
  invalidRootPackageJson?: boolean;
  missingRootPackageJson?: boolean;
  missingWorkspaceConfig?: boolean;
  workspacePatterns?: string[];
  missingEslintConfig?: boolean;
  brokenEslintConfig?: boolean;
  withoutOpenApiGenerator?: boolean;
  invalidOpenApiSpec?: boolean;
  isolateNodeModules?: boolean;
  withEslintBoundaryFixtures?: boolean;
}

export type DoctorViolationKind =
  | "private-import"
  | "direct-env"
  | "raw-fetch"
  | "reference-import"
  | "cross-feature-import"
  | "custom-feature-root-cross-import"
  | "custom-feature-root-reference-import"
  | "custom-feature-root-raw-fetch"
  | "custom-feature-root-direct-env"
  | "custom-feature-root-allowed"
  | "custom-feature-root-parser-failure"
  | "custom-feature-root-unrelated-lint"
  | "undeclared-dependency"
  | "undeclared-next-navigation"
  | "undeclared-react-jsx-runtime"
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
    customProductFeaturesRoot: options?.customProductFeaturesRoot,
  });

  if (options?.missingRootPackageJson) {
    rmSync(path.join(fixture.root, "package.json"));
  } else if (options?.invalidRootPackageJson) {
    writeFileSync(path.join(fixture.root, "package.json"), "{ invalid", "utf8");
  } else if (options?.checkoutVersion) {
    writeFileSync(
      path.join(fixture.root, "package.json"),
      `${JSON.stringify(
        {
          name: "@atlas/monorepo",
          version: options.checkoutVersion,
          private: true,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  if (options?.missingWorkspaceConfig) {
    const workspacePath = path.join(fixture.root, "pnpm-workspace.yaml");
    if (existsSync(workspacePath)) {
      rmSync(workspacePath);
    }
  } else {
    const patterns = options?.workspacePatterns ?? ['"apps/*"', '"packages/*"'];
    writeFileSync(
      path.join(fixture.root, "pnpm-workspace.yaml"),
      `packages:\n${patterns.map((pattern) => `  - ${pattern}`).join("\n")}\n`,
      "utf8"
    );
  }

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
          ...(options?.withoutOpenApiGenerator ? {} : { "openapi-typescript": "7.10.1" }),
        },
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  mkdirSync(path.join(fixture.root, "apps/web/src"), { recursive: true });

  if (options?.customProductFeaturesRoot || options?.externalProductFeaturesRoot) {
    const productRoot = options.externalProductFeaturesRoot ?? options.customProductFeaturesRoot!;
    writeFileSync(
      path.join(fixture.root, "atlas.config.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          features: {
            product: productRoot,
            reference: options.externalProductFeaturesRoot
              ? `${productRoot}/reference`
              : `${options.customProductFeaturesRoot}/reference`,
            examples: options.externalProductFeaturesRoot
              ? `${productRoot}/examples`
              : `${options.customProductFeaturesRoot}/examples`,
          },
          capabilities: {
            openApi: options.openApi ?? false,
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    mkdirSync(path.join(fixture.root, productRoot, "billing"), { recursive: true });
  }

  if (options?.withApplicationTooling ?? true) {
    copyApplicationDoctorTooling(fixture.root, {
      missingEslintConfig: options?.missingEslintConfig,
      brokenEslintConfig: options?.brokenEslintConfig,
      linkNodeModules: !options?.isolateNodeModules,
      withBoundaryFixtures: options?.withEslintBoundaryFixtures ?? true,
    });
  }

  if (options?.openApi) {
    seedOpenApiArtifacts(fixture.root, {
      stale: options.withViolation === "stale-openapi",
      invalidSpec: options.invalidOpenApiSpec,
    });
  }

  if (options?.withViolation) {
    applyDoctorViolation(fixture.root, options.withViolation, options.customProductFeaturesRoot);
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

function copyApplicationDoctorTooling(
  fixtureRoot: string,
  options: {
    missingEslintConfig?: boolean;
    brokenEslintConfig?: boolean;
    linkNodeModules?: boolean;
    withBoundaryFixtures?: boolean;
  }
): void {
  const sourceAppRoot = path.join(REPO_ROOT, "apps/web");
  const targetAppRoot = path.join(fixtureRoot, "apps/web");

  for (const fileName of ["architecture-policy.mjs", "tsconfig.json"]) {
    copyFileSync(path.join(sourceAppRoot, fileName), path.join(targetAppRoot, fileName));
  }

  writeFileSync(
    path.join(targetAppRoot, "next-env.d.ts"),
    '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
    "utf8"
  );

  if (options.missingEslintConfig) {
    return;
  }

  if (options.brokenEslintConfig) {
    writeFileSync(
      path.join(targetAppRoot, "eslint.config.mjs"),
      "import broken from 'definitely-not-a-real-eslint-module';\nexport default broken;\n",
      "utf8"
    );
  } else {
    copyFileSync(
      path.join(sourceAppRoot, "eslint.config.mjs"),
      path.join(targetAppRoot, "eslint.config.mjs")
    );
  }

  if (options.withBoundaryFixtures ?? true) {
    cpSync(
      path.join(sourceAppRoot, "src/components/eslint-boundaries"),
      path.join(targetAppRoot, "src/components/eslint-boundaries"),
      {
        recursive: true,
      }
    );
  }

  if (options.linkNodeModules ?? true) {
    linkIfAbsent(path.join(REPO_ROOT, "node_modules"), path.join(fixtureRoot, "node_modules"));
    linkIfAbsent(
      path.join(sourceAppRoot, "node_modules"),
      path.join(targetAppRoot, "node_modules")
    );
    linkIfAbsent(path.join(REPO_ROOT, "packages/ui"), path.join(fixtureRoot, "packages/ui"));
    linkIfAbsent(
      path.join(REPO_ROOT, "packages/config"),
      path.join(fixtureRoot, "packages/config")
    );
  } else {
    cpSync(path.join(REPO_ROOT, "packages/ui"), path.join(fixtureRoot, "packages/ui"), {
      recursive: true,
    });
    cpSync(path.join(REPO_ROOT, "packages/config"), path.join(fixtureRoot, "packages/config"), {
      recursive: true,
    });
  }
}

function linkIfAbsent(source: string, target: string): void {
  if (existsSync(target)) {
    return;
  }

  symlinkSync(source, target, "dir");
}

function seedOpenApiArtifacts(
  fixtureRoot: string,
  options: { stale: boolean; invalidSpec?: boolean }
): void {
  const specSource = path.join(REPO_ROOT, "openapi/openapi.json");
  const schemaSource = path.join(REPO_ROOT, "apps/web/src/lib/api/contracts/schema.ts");
  const specTarget = path.join(fixtureRoot, "openapi/openapi.json");
  const schemaTarget = path.join(fixtureRoot, "apps/web/src/lib/api/contracts/schema.ts");

  mkdirSync(path.dirname(specTarget), { recursive: true });
  mkdirSync(path.dirname(schemaTarget), { recursive: true });

  if (options.invalidSpec) {
    writeFileSync(specTarget, "{ invalid openapi", "utf8");
  } else {
    copyFileSync(specSource, specTarget);
  }

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

  if (options.stale) {
    writeFileSync(schemaTarget, "// stale generated artifact\n", "utf8");
  }
}

const CUSTOM_PRODUCT_ROOT = "apps/web/src/domains";

function isCustomProductRoot(productRoot: string): boolean {
  return productRoot === CUSTOM_PRODUCT_ROOT;
}

function applyDoctorViolation(
  fixtureRoot: string,
  violation: DoctorViolationKind,
  customProductFeaturesRoot?: string
): void {
  const productRoot = customProductFeaturesRoot ?? "apps/web/src/features";

  switch (violation) {
    case "private-import":
      writeViolationFile(
        fixtureRoot,
        `${productRoot}/billing/example.ts`,
        "import { Button } from '../../../../../packages/ui/src/components/ui/button';\nvoid Button;\n"
      );
      break;
    case "direct-env":
      if (isCustomProductRoot(productRoot)) {
        writeViolationFile(
          fixtureRoot,
          `${productRoot}/billing/env.ts`,
          "type ConfigValue = string | undefined;\n\nexport const value: ConfigValue = process.env.SECRET;\n"
        );
      } else {
        writeViolationFile(
          fixtureRoot,
          `${productRoot}/billing/env.ts`,
          "export const apiUrl = process.env.NEXT_PUBLIC_API_URL;\n"
        );
      }
      break;
    case "raw-fetch":
      if (isCustomProductRoot(productRoot)) {
        writeViolationFile(
          fixtureRoot,
          `${productRoot}/billing/query.ts`,
          "interface BillingResult {\n  id: string;\n}\n\nexport async function loadBilling(): Promise<BillingResult> {\n  return fetch('/api/billing');\n}\n"
        );
      } else {
        writeViolationFile(
          fixtureRoot,
          `${productRoot}/billing/network.ts`,
          "export async function load() { return fetch('/api/example'); }\n"
        );
      }
      break;
    case "reference-import":
      mkdirSync(path.join(fixtureRoot, `${productRoot}/reference/users`), { recursive: true });
      writeFileSync(
        path.join(fixtureRoot, `${productRoot}/reference/users/index.ts`),
        "export const reference = true;\n",
        "utf8"
      );
      writeViolationFile(
        fixtureRoot,
        `${productRoot}/billing/reference.ts`,
        customProductFeaturesRoot
          ? "import { reference } from '@/domains/reference/users';\nvoid reference;\n"
          : "import { userKeys } from '@/features/reference/users';\nvoid userKeys;\n"
      );
      break;
    case "cross-feature-import":
      mkdirSync(path.join(fixtureRoot, `${productRoot}/users`), { recursive: true });
      writeFileSync(
        path.join(fixtureRoot, `${productRoot}/users/index.ts`),
        "export const users = true;\n",
        "utf8"
      );
      writeViolationFile(
        fixtureRoot,
        `${productRoot}/billing/cross.ts`,
        customProductFeaturesRoot
          ? "import { users } from '@/domains/users';\nvoid users;\n"
          : "import { users } from '@/features/users';\nvoid users;\n"
      );
      break;
    case "custom-feature-root-cross-import":
      applyDoctorViolation(fixtureRoot, "cross-feature-import", CUSTOM_PRODUCT_ROOT);
      break;
    case "custom-feature-root-reference-import":
      applyDoctorViolation(fixtureRoot, "reference-import", CUSTOM_PRODUCT_ROOT);
      break;
    case "custom-feature-root-raw-fetch":
      applyDoctorViolation(fixtureRoot, "raw-fetch", CUSTOM_PRODUCT_ROOT);
      break;
    case "custom-feature-root-direct-env":
      applyDoctorViolation(fixtureRoot, "direct-env", CUSTOM_PRODUCT_ROOT);
      break;
    case "custom-feature-root-allowed":
      writeViolationFile(
        fixtureRoot,
        `${CUSTOM_PRODUCT_ROOT}/billing/allowed.ts`,
        "import { apiGet } from '@/lib/api';\n\ninterface Billing {\n  id: string;\n}\n\nexport async function loadBilling(): Promise<Billing> {\n  return apiGet<Billing>('/api/billing');\n}\n"
      );
      break;
    case "custom-feature-root-parser-failure":
      writeViolationFile(
        fixtureRoot,
        `${CUSTOM_PRODUCT_ROOT}/billing/broken.ts`,
        "interface Broken {\n  value:\n}\n"
      );
      break;
    case "custom-feature-root-unrelated-lint":
      writeViolationFile(
        fixtureRoot,
        `${CUSTOM_PRODUCT_ROOT}/billing/console.ts`,
        "console.log('test');\nexport const ok = true;\n"
      );
      break;
    case "undeclared-dependency":
      writeViolationFile(
        fixtureRoot,
        `${productRoot}/billing/undeclared.ts`,
        "import { z } from 'zod';\nexport const schema = z.object({ id: z.string() });\n"
      );
      break;
    case "undeclared-next-navigation":
      writeViolationFile(
        fixtureRoot,
        "apps/web/src/features/billing/navigation.ts",
        "import { redirect } from 'next/navigation';\nvoid redirect;\n"
      );
      break;
    case "undeclared-react-jsx-runtime":
      writeViolationFile(
        fixtureRoot,
        "apps/web/src/features/billing/runtime.ts",
        "import 'react/jsx-runtime';\n"
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
    const segments = relativePath.split(/[/\\]/);
    if (segments.includes("node_modules") || segments.includes("packages")) {
      return;
    }

    const absolutePath = path.join(fixtureRoot, relativePath);
    for (const entry of readdirSync(absolutePath)) {
      if (entry === "node_modules" || entry === "packages" || entry.startsWith(".")) {
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

export function writeCommentedImportFixture(fixtureRoot: string): void {
  writeViolationFile(
    fixtureRoot,
    "apps/web/src/features/billing/commented.ts",
    '// import { z } from "fake-package";\nconst text = \'import foo from "fake-package"\';\nexport const ok = true;\n'
  );
}
