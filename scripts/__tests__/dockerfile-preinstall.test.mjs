import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FROZEN_INSTALL = "RUN pnpm install --frozen-lockfile";

function extractNodeScriptPaths(command) {
  if (typeof command !== "string" || command.length === 0) {
    return [];
  }

  const paths = [];
  const pattern = /\bnode\s+([^\s;&|]+)/g;
  let match = pattern.exec(command);

  while (match !== null) {
    const candidate = match[1];
    if (!candidate.startsWith("-")) {
      const normalized = candidate.replace(/^\.\//, "");
      if (!normalized.startsWith("node_modules/")) {
        paths.push(normalized);
      }
    }
    match = pattern.exec(command);
  }

  return paths;
}

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

describe("Dockerfile copies preinstall scripts before dependency install", () => {
  it("rejects a Dockerfile that installs before copying the invoked script", () => {
    const dockerfile = `COPY package.json ./
RUN pnpm install --frozen-lockfile
COPY scripts/ensure-pnpm.js ./scripts/ensure-pnpm.js
`;

    assert.equal(
      dockerfileCopiesPathBeforeFrozenInstall(dockerfile, "scripts/ensure-pnpm.js"),
      false
    );
  });

  it("copies Atlas-owned files invoked by root preinstall before frozen-lockfile install", () => {
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    const dockerfile = readFileSync(path.join(repoRoot, "Dockerfile"), "utf8");
    const preinstall = packageJson.scripts?.preinstall;

    assert.equal(typeof preinstall, "string");
    assert.notEqual(preinstall.length, 0);

    const invokedFiles = extractNodeScriptPaths(preinstall);
    assert.ok(
      invokedFiles.length > 0,
      "root preinstall must invoke at least one Atlas-owned node script"
    );

    for (const relativePath of invokedFiles) {
      assert.equal(
        existsSync(path.join(repoRoot, relativePath)),
        true,
        `${relativePath} must exist in the repository`
      );
      assert.equal(
        dockerfileCopiesPathBeforeFrozenInstall(dockerfile, relativePath),
        true,
        `${relativePath} must be copied before ${FROZEN_INSTALL}`
      );
    }
  });
});
