import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface MinimalAtlasFixture {
  root: string;
  cleanup: () => void;
}

export function createMinimalAtlasFixture(options?: {
  withContract?: boolean;
  invalidContract?: boolean;
  withEnvExample?: boolean;
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

  writeFileSync(
    path.join(root, "packages/ui/package.json"),
    `${JSON.stringify({ name: "@atlas/ui", version: "0.1.0", private: true }, null, 2)}\n`,
    "utf8"
  );

  if (options?.withEnvExample) {
    writeFileSync(path.join(root, "apps/web/.env.example"), "NEXT_PUBLIC_APP_NAME=Atlas\n", "utf8");
  }

  if (options?.invalidContract) {
    writeFileSync(path.join(root, "atlas.config.json"), "{ invalid json", "utf8");
  } else if (options?.withContract) {
    writeFileSync(
      path.join(root, "atlas.config.json"),
      `${JSON.stringify({ schemaVersion: 1 }, null, 2)}\n`,
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
