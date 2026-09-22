import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FROZEN_INSTALL = "RUN pnpm install --frozen-lockfile";

function dockerfileCopiesPathBeforeFrozenInstall(dockerfile, relativePath) {
  const installIndex = dockerfile.indexOf(FROZEN_INSTALL);
  if (installIndex === -1) {
    return false;
  }

  const copyLines = dockerfile
    .slice(0, installIndex)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("COPY ") && !line.startsWith("COPY --from="));

  return copyLines.some((line) => {
    const tokens = line.slice("COPY ".length).split(/\s+/);
    if (tokens.length < 2) {
      return false;
    }

    return tokens.slice(0, -1).some((source) => {
      const normalized = source.replace(/^\.\//, "").replace(/\/$/, "");
      return normalized === relativePath || relativePath.startsWith(`${normalized}/`);
    });
  });
}

function workspaceManifestsByPackageName() {
  const manifests = new Map();

  for (const parent of ["apps", "packages"]) {
    const parentDir = path.join(repoRoot, parent);
    for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const relativeManifest = `${parent}/${entry.name}/package.json`;
      const absoluteManifest = path.join(repoRoot, relativeManifest);
      if (!existsSync(absoluteManifest)) {
        continue;
      }

      const pkg = JSON.parse(readFileSync(absoluteManifest, "utf8"));
      if (typeof pkg.name === "string" && pkg.name.length > 0) {
        manifests.set(pkg.name, relativeManifest);
      }
    }
  }

  return manifests;
}

function workspaceDependencyNames(packageJson) {
  const combined = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };

  return Object.entries(combined)
    .filter(([, version]) => typeof version === "string" && version.startsWith("workspace:"))
    .map(([name]) => name)
    .sort();
}

describe("Dockerfile copies web workspace manifests before dependency install", () => {
  it("copies each @atlas/web workspace package.json before frozen-lockfile install", () => {
    const dockerfile = readFileSync(path.join(repoRoot, "Dockerfile"), "utf8");
    const webPackage = JSON.parse(readFileSync(path.join(repoRoot, "apps/web/package.json"), "utf8"));
    const manifests = workspaceManifestsByPackageName();
    const workspaceDeps = workspaceDependencyNames(webPackage);

    assert.ok(workspaceDeps.includes("@atlas/consent"));
    assert.ok(workspaceDeps.includes("@atlas/ui"));

    for (const name of workspaceDeps) {
      const relativeManifest = manifests.get(name);
      assert.equal(
        typeof relativeManifest,
        "string",
        `${name} must resolve to a workspace package.json`
      );
      assert.equal(
        dockerfileCopiesPathBeforeFrozenInstall(dockerfile, relativeManifest),
        true,
        `${relativeManifest} must be copied before ${FROZEN_INSTALL}`
      );
    }
  });

  it("creates apps/web/public before the production-stage copy", () => {
    const dockerfile = readFileSync(path.join(repoRoot, "Dockerfile"), "utf8");
    const mkdirIndex = dockerfile.indexOf("RUN mkdir -p apps/web/public");
    const publicCopyIndex = dockerfile.indexOf(
      "COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public"
    );

    assert.ok(mkdirIndex !== -1, "Dockerfile must create apps/web/public");
    assert.ok(publicCopyIndex !== -1, "runner must copy apps/web/public from the builder");
    assert.ok(
      mkdirIndex < publicCopyIndex,
      "apps/web/public must exist in the builder before the runner copies it"
    );
  });
});
