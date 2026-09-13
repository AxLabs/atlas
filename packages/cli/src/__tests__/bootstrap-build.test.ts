import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildBootstrapAssets, readSourceBootstrapManifest } from "../bootstrap/build";
import { SOURCE_BOOTSTRAP_MANIFEST_RELATIVE_PATH } from "../bootstrap/constants";
import {
  CONSUMER_UI_PACKAGE_JSON_DESTINATION,
  shouldOmitConsumerUiDevDependency,
  shouldOmitConsumerUiScript,
  toConsumerUiPackageManifest,
} from "../bootstrap/consumer-ui-manifest";
import { verifyPackagedBootstrapTree } from "../bootstrap/integrity";
import { serializePackagedBootstrapManifest } from "../bootstrap/schema";
import {
  AGENT_ADR_REFERENCES,
  AGENT_DOCUMENTATION_REFERENCES,
} from "../context/documentation-registry";
import { loadAppInfrastructureManifest } from "../template-sync/manifest";
import { getRepoRoot } from "./helpers/run-cli";

const CLI_PACKAGE_ROOT = path.resolve(__dirname, "../..");
const BUILD_TIMEOUT_MS = 120_000;

function listDestinations(outputDir: string): string[] {
  const manifest = JSON.parse(readFileSync(path.join(outputDir, "manifest.json"), "utf8")) as {
    entries: { destination: string }[];
  };
  return manifest.entries.map((entry) => entry.destination);
}

describe("bootstrap asset build", () => {
  const repoRoot = getRepoRoot();

  it(
    "builds a deterministic packaged tree from canonical Atlas source",
    () => {
      const first = mkdtempSync(path.join(os.tmpdir(), "atlas-bootstrap-a-"));
      const second = mkdtempSync(path.join(os.tmpdir(), "atlas-bootstrap-b-"));

      try {
        const firstManifest = buildBootstrapAssets({
          repoRoot,
          packageRoot: CLI_PACKAGE_ROOT,
          outputDir: first,
        });
        const secondManifest = buildBootstrapAssets({
          repoRoot,
          packageRoot: CLI_PACKAGE_ROOT,
          outputDir: second,
        });

        expect(serializePackagedBootstrapManifest(firstManifest)).toBe(
          serializePackagedBootstrapManifest(secondManifest)
        );
        expect(listDestinations(first)).toEqual(listDestinations(second));
        expect(firstManifest.entries.map((entry) => entry.sha256)).toEqual(
          secondManifest.entries.map((entry) => entry.sha256)
        );

        verifyPackagedBootstrapTree(first);
        verifyPackagedBootstrapTree(second);
      } finally {
        rmSync(first, { recursive: true, force: true });
        rmSync(second, { recursive: true, force: true });
      }
    },
    BUILD_TIMEOUT_MS
  );

  it(
    "replaces stale generated bootstrap files on rebuild",
    () => {
      const outputDir = mkdtempSync(path.join(os.tmpdir(), "atlas-bootstrap-stale-"));
      try {
        buildBootstrapAssets({
          repoRoot,
          packageRoot: CLI_PACKAGE_ROOT,
          outputDir,
        });
        const stalePath = path.join(outputDir, "files", "stale-generated.txt");
        mkdirSync(path.dirname(stalePath), { recursive: true });
        writeFileSync(stalePath, "stale\n");

        buildBootstrapAssets({
          repoRoot,
          packageRoot: CLI_PACKAGE_ROOT,
          outputDir,
        });

        expect(existsSync(stalePath)).toBe(false);
        verifyPackagedBootstrapTree(outputDir);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    },
    BUILD_TIMEOUT_MS
  );

  it(
    "keeps template-sync owned starter paths inside the bootstrap allowlist",
    () => {
      const outputDir = mkdtempSync(path.join(os.tmpdir(), "atlas-bootstrap-ownership-"));
      try {
        const packaged = buildBootstrapAssets({
          repoRoot,
          packageRoot: CLI_PACKAGE_ROOT,
          outputDir,
        });
        const destinations = new Set(packaged.entries.map((entry) => entry.destination));
        const templateManifest = loadAppInfrastructureManifest(repoRoot);
        const required = [
          ...templateManifest.syncedPaths,
          ...templateManifest.generatedPaths,
          ...templateManifest.starterOnlyPaths,
          ...(templateManifest.structuralConformance?.requiredInfrastructureModules ?? []),
        ];

        const missing = required
          .map((relativePath) => `${templateManifest.canonicalApplication}/${relativePath}`)
          .filter((destination) => !destinations.has(destination));

        expect(missing).toEqual([]);
        expect(destinations.has("apps/reference/package.json")).toBe(false);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    },
    BUILD_TIMEOUT_MS
  );

  it("packages the documentation paths advertised by atlas context", () => {
    const source = readSourceBootstrapManifest(
      path.join(CLI_PACKAGE_ROOT, SOURCE_BOOTSTRAP_MANIFEST_RELATIVE_PATH)
    );
    const destinations = new Set(source.entries.map((entry) => entry.destination));

    for (const reference of [...AGENT_DOCUMENTATION_REFERENCES, ...AGENT_ADR_REFERENCES]) {
      expect(destinations.has(reference.path)).toBe(true);
    }
    expect(destinations.has("AGENTS.md")).toBe(true);
  });

  it(
    "packages a consumer-safe UI manifest and the Lighthouse config the web script references",
    () => {
      const outputDir = mkdtempSync(path.join(os.tmpdir(), "atlas-bootstrap-coherence-"));
      try {
        const packaged = buildBootstrapAssets({
          repoRoot,
          packageRoot: CLI_PACKAGE_ROOT,
          outputDir,
        });
        const destinations = new Set(packaged.entries.map((entry) => entry.destination));
        const filesRoot = path.join(outputDir, "files");
        const packagedUiPath = path.join(
          filesRoot,
          ...CONSUMER_UI_PACKAGE_JSON_DESTINATION.split("/")
        );
        const canonicalUiRaw = readFileSync(
          path.join(repoRoot, CONSUMER_UI_PACKAGE_JSON_DESTINATION),
          "utf8"
        );
        const packagedUiRaw = readFileSync(packagedUiPath, "utf8");
        const packagedUi = JSON.parse(packagedUiRaw) as {
          scripts?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        const canonicalUi = JSON.parse(canonicalUiRaw) as {
          scripts?: Record<string, string>;
        };
        expect(packagedUiRaw).toBe(toConsumerUiPackageManifest(canonicalUiRaw));
        expect(packagedUiRaw).not.toBe(canonicalUiRaw);
        expect(canonicalUi.scripts?.storybook).toBeDefined();

        for (const [name, value] of Object.entries(packagedUi.scripts ?? {})) {
          expect(shouldOmitConsumerUiScript(name, value)).toBe(false);
        }
        expect(
          Object.keys(packagedUi.devDependencies ?? {}).filter((name) =>
            shouldOmitConsumerUiDevDependency(name)
          )
        ).toEqual([]);
        expect(packagedUi.scripts?.lint).toBeDefined();
        expect(packagedUi.scripts?.typecheck).toBeDefined();
        expect(packagedUi.scripts?.test).toBeDefined();
        expect(packagedUi.devDependencies?.["@playwright/test"]).toBeUndefined();
        expect(packagedUi.devDependencies?.storybook).toBeUndefined();
        expect(packagedUi.devDependencies?.husky).toBeUndefined();

        expect(destinations.has("lighthouserc.json")).toBe(true);
        expect(existsSync(path.join(filesRoot, "lighthouserc.json"))).toBe(true);

        const webPackage = JSON.parse(
          readFileSync(path.join(filesRoot, "apps", "web", "package.json"), "utf8")
        ) as { scripts?: Record<string, string> };
        const lhciScript = webPackage.scripts?.["perf:lhci"];
        expect(lhciScript).toMatch(/--config=/);
        const configMatch = lhciScript?.match(/--config=(\S+)/);
        expect(configMatch?.[1]).toBeDefined();
        const resolvedConfig = path.posix.normalize(
          path.posix.join("apps/web", configMatch?.[1] as string)
        );
        expect(resolvedConfig.startsWith("../")).toBe(false);
        expect(destinations.has(resolvedConfig)).toBe(true);
        expect(existsSync(path.join(filesRoot, ...resolvedConfig.split("/")))).toBe(true);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    },
    BUILD_TIMEOUT_MS
  );

  it("does not package generated-at-init or repository-only surfaces", () => {
    const source = readSourceBootstrapManifest(
      path.join(CLI_PACKAGE_ROOT, SOURCE_BOOTSTRAP_MANIFEST_RELATIVE_PATH)
    );
    const destinations = new Set(source.entries.map((entry) => entry.destination));
    const generated = new Set(source.generatedAtInit.map((entry) => entry.destination));

    expect(generated.has("atlas.config.json")).toBe(true);
    expect(generated.has("package.json")).toBe(true);
    expect(generated.has("pnpm-lock.yaml")).toBe(true);
    expect(destinations.has("atlas.config.json")).toBe(false);
    expect(destinations.has("package.json")).toBe(false);
    expect(destinations.has("pnpm-lock.yaml")).toBe(false);
    expect(destinations.has("apps/reference")).toBe(false);
    expect(destinations.has("packages/cli")).toBe(false);
    expect(destinations.has("packages/project")).toBe(false);
    expect(destinations.has("lighthouserc.json")).toBe(true);
  });
});
