import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

export interface MinimalAtlasFixture {
  root: string;
  cleanup: () => void;
}

export interface GeneratorAtlasFixtureOptions {
  withContract?: boolean;
  invalidContract?: boolean;
  structurallyInvalidContract?: boolean;
  wrongUiPackageName?: boolean;
  withEnvExample?: boolean;
  withEnvLocal?: boolean;
  withReferencePaths?: boolean;
  customProductFeaturesRoot?: string;
  openApi?: boolean;
}

export function createMinimalAtlasFixture(options?: {
  withContract?: boolean;
  invalidContract?: boolean;
  structurallyInvalidContract?: boolean;
  wrongUiPackageName?: boolean;
  withEnvExample?: boolean;
  withEnvLocal?: boolean;
  withReferencePaths?: boolean;
}): MinimalAtlasFixture {
  return createGeneratorAtlasFixture(options);
}

export function createGeneratorAtlasFixture(
  options?: GeneratorAtlasFixtureOptions
): MinimalAtlasFixture {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-cli-fixture-"));
  const productFeaturesRoot = options?.customProductFeaturesRoot ?? "apps/web/src/features";
  const openApi = options?.openApi ?? false;

  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "@atlas/monorepo",
        version: "0.1.0",
        private: true,
        engines: {
          node: ">=22.0.0",
          pnpm: ">=10.0.0",
        },
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  mkdirSync(path.join(root, "apps/web"), { recursive: true });
  mkdirSync(path.join(root, productFeaturesRoot), { recursive: true });
  mkdirSync(path.join(root, "apps/web/src/app"), { recursive: true });
  mkdirSync(path.join(root, "packages/ui"), { recursive: true });

  if (options?.structurallyInvalidContract) {
    mkdirSync(path.join(root, "packages/config"), { recursive: true });
    writeFileSync(
      path.join(root, "packages/config/package.json"),
      `${JSON.stringify({ name: "@atlas/config", version: "0.1.0", private: true }, null, 2)}\n`,
      "utf8"
    );
  }

  writeFileSync(
    path.join(root, "packages/ui/package.json"),
    `${JSON.stringify(
      {
        name: options?.wrongUiPackageName ? "@wrong/ui" : "@atlas/ui",
        version: "0.1.0",
        private: true,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  if (options?.withEnvExample) {
    writeFileSync(path.join(root, "apps/web/.env.example"), "NEXT_PUBLIC_APP_NAME=Atlas\n", "utf8");
  }

  if (options?.withEnvLocal) {
    writeFileSync(
      path.join(root, "apps/web/.env.local"),
      "NEXT_PUBLIC_APP_NAME=Existing\n",
      "utf8"
    );
  }

  if (options?.withReferencePaths) {
    mkdirSync(path.join(root, "apps/web/src/features/reference"), { recursive: true });
    mkdirSync(path.join(root, "apps/web/src/features/examples"), { recursive: true });
    mkdirSync(path.join(root, "apps/web/src/components/reference"), { recursive: true });
    mkdirSync(path.join(root, "apps/web/src/app/examples"), { recursive: true });
  }

  if (options?.invalidContract) {
    writeFileSync(path.join(root, "atlas.config.json"), "{ invalid json", "utf8");
  } else if (options?.structurallyInvalidContract) {
    writeFileSync(
      path.join(root, "atlas.config.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          ui: {
            package: "@atlas/ui",
            path: "packages/config",
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  } else if (options?.withContract || options?.customProductFeaturesRoot !== undefined) {
    writeFileSync(
      path.join(root, "atlas.config.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          features: {
            product: productFeaturesRoot,
          },
          capabilities: {
            openApi,
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  return {
    root,
    cleanup: () => {
      // Temporary directories are cleaned by the OS; explicit rm is avoided for speed.
    },
  };
}

export function snapshotFixturePaths(fixtureRoot: string): {
  contract?: string;
  envLocal?: string;
  referencePaths: string[];
} {
  const contractPath = path.join(fixtureRoot, "atlas.config.json");
  const envLocalPath = path.join(fixtureRoot, "apps/web/.env.local");
  const referencePaths = [
    "apps/web/src/features/reference",
    "apps/web/src/features/examples",
    "apps/web/src/components/reference",
    "apps/web/src/app/examples",
  ].map((relativePath) => path.join(fixtureRoot, relativePath));

  return {
    contract: existsSync(contractPath) ? readFileSync(contractPath, "utf8") : undefined,
    envLocal: existsSync(envLocalPath) ? readFileSync(envLocalPath, "utf8") : undefined,
    referencePaths: referencePaths.filter((absolutePath) => existsSync(absolutePath)),
  };
}

export function readFixtureTree(relativeFixtureRoot: string): Record<string, string> {
  const absoluteRoot = path.join(__dirname, "..", "fixtures", "generators", relativeFixtureRoot);
  const files: Record<string, string> = {};

  function walk(currentRelative: string): void {
    const absoluteCurrent = path.join(absoluteRoot, currentRelative);
    for (const entry of readdirSync(absoluteCurrent)) {
      const nextRelative = path.join(currentRelative, entry);
      const absoluteEntry = path.join(absoluteRoot, nextRelative);
      const stats = statSync(absoluteEntry);
      if (stats.isDirectory()) {
        walk(nextRelative);
        continue;
      }

      files[nextRelative.replace(/\\/g, "/")] = readFileSync(absoluteEntry, "utf8");
    }
  }

  walk(".");
  return files;
}

export function readGeneratedTree(
  fixtureRoot: string,
  relativeRoot: string
): Record<string, string> {
  const absoluteRoot = path.join(fixtureRoot, relativeRoot);
  if (!existsSync(absoluteRoot)) {
    return {};
  }

  const files: Record<string, string> = {};

  function walk(currentRelative: string): void {
    const absoluteCurrent = path.join(absoluteRoot, currentRelative);
    for (const entry of readdirSync(absoluteCurrent)) {
      const nextRelative = path.join(currentRelative, entry);
      const absoluteEntry = path.join(absoluteRoot, nextRelative);
      const stats = statSync(absoluteEntry);
      if (stats.isDirectory()) {
        walk(nextRelative);
        continue;
      }

      files[path.posix.join(relativeRoot, nextRelative).replace(/\\/g, "/")] = readFileSync(
        absoluteEntry,
        "utf8"
      );
    }
  }

  walk(".");
  return files;
}
