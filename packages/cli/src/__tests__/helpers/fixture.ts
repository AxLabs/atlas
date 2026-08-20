import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface MinimalAtlasFixture {
  root: string;
  cleanup: () => void;
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
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-cli-fixture-"));

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
  mkdirSync(path.join(root, "apps/web/src/features"), { recursive: true });
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
  } else if (options?.withContract) {
    writeFileSync(
      path.join(root, "atlas.config.json"),
      `${JSON.stringify({ schemaVersion: 1, capabilities: { openApi: false } }, null, 2)}\n`,
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
