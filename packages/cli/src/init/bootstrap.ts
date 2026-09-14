import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  ATLAS_CONTRACT_FILENAME,
  AtlasBaselineCaptureError,
  DEFAULT_ATLAS_PROJECT_CONTRACT,
  LATEST_SCHEMA_VERSION,
  resolveAtlasProject,
} from "@atlas/project";

import { BootstrapAssetError } from "../bootstrap/errors";
import { verifyPackagedBootstrapTree } from "../bootstrap/integrity";
import { resolveContainedPath } from "../bootstrap/paths";
import {
  findBootstrapAssetRoot,
  packagedBootstrapFilesRoot,
  readBootstrapManifest,
} from "../bootstrap/resolve";
import { CliError, CliErrorCode } from "../errors/cli-error";
import { cliErrorFromContract } from "../errors/from-contract";
import { loadAppInfrastructureManifest } from "../template-sync/manifest";
import {
  captureConsumerPlatformBaseline,
  mergePlatformBaselineIntoContract,
} from "../upgrade/baseline";

import {
  buildConsumerContract,
  buildConsumerJestConfig,
  buildConsumerPackageManifest,
  buildConsumerReadme,
  planGeneratedAtInitActions,
} from "./consumer-files";
import {
  ensureDestinationParent,
  removeEmptyDirectories,
  resolveBootstrapDestination,
} from "./destination";
import { validatePrerequisites } from "./prerequisites";
import { bootstrapProjectName } from "./project-path";
import { normalizeGeneratedInfrastructureManifest } from "./template-manifest";

import type { PackagedBootstrapManifest } from "../bootstrap/schema";
import type { CommandResult, PlannedAction } from "../types/result";
import type { EnvPolicy, ReferencePolicy } from "./types";

export interface BootstrapInitOptions {
  cwd?: string;
  project: string;
  dryRun?: boolean;
  env: EnvPolicy;
  reference: ReferencePolicy;
  /** Test seam: packaged bootstrap asset root inside an installed CLI layout. */
  assetRoot?: string;
  /** Test seam: invoked after staging succeeds and before the destination is promoted. */
  beforePromote?: () => void;
}

function bootstrapAssetError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }
  if (error instanceof BootstrapAssetError) {
    return new CliError(CliErrorCode.PREREQUISITE_ERROR, error.message, { cause: error });
  }
  const message =
    error instanceof Error ? error.message : "Packaged bootstrap assets are unusable.";
  return new CliError(CliErrorCode.PREREQUISITE_ERROR, message, { cause: error });
}

function loadVerifiedBootstrapManifest(assetRoot: string): PackagedBootstrapManifest {
  try {
    verifyPackagedBootstrapTree(assetRoot);
    return readBootstrapManifest(assetRoot);
  } catch (error) {
    throw bootstrapAssetError(error);
  }
}

function materializePackagedFiles(
  filesRoot: string,
  destinationRoot: string,
  manifest: PackagedBootstrapManifest
): void {
  for (const entry of manifest.entries) {
    const sourcePath = resolveContainedPath(filesRoot, entry.destination, "bootstrap asset");
    const destinationPath = resolveContainedPath(
      destinationRoot,
      entry.destination,
      "project file"
    );
    mkdirSync(path.dirname(destinationPath), { recursive: true });
    copyFileSync(sourcePath, destinationPath);
    chmodSync(destinationPath, Number.parseInt(entry.mode, 8));
  }
}

function maybeCopyEnvLocal(destinationRoot: string, env: EnvPolicy): PlannedAction {
  const targetRelative = path.posix.join(
    DEFAULT_ATLAS_PROJECT_CONTRACT.application.root,
    ".env.local"
  );
  const exampleRelative = path.posix.join(
    DEFAULT_ATLAS_PROJECT_CONTRACT.application.root,
    ".env.example"
  );
  const targetPath = path.join(destinationRoot, ...targetRelative.split("/"));
  const examplePath = path.join(destinationRoot, ...exampleRelative.split("/"));

  if (env === "skip") {
    return {
      kind: "skip",
      path: targetRelative,
      reason:
        "Environment setup skipped (--env skip); .env.example remains the documented template",
    };
  }

  if (!existsSync(examplePath)) {
    return {
      kind: "skip",
      path: targetRelative,
      reason: `${exampleRelative} not found`,
    };
  }

  mkdirSync(path.dirname(targetPath), { recursive: true });
  copyFileSync(examplePath, targetPath);
  return {
    kind: "copy",
    path: targetRelative,
    reason: "Copy .env.example to .env.local",
  };
}

function writeGeneratedFiles(options: {
  destinationRoot: string;
  projectName: string;
  atlasVersion: string;
  env: EnvPolicy;
}): PlannedAction[] {
  const packageJson = buildConsumerPackageManifest({
    projectName: options.projectName,
    atlasVersion: options.atlasVersion,
    includePerfCommands: existsSync(path.join(options.destinationRoot, "lighthouserc.json")),
  });
  writeFileSync(path.join(options.destinationRoot, "package.json"), packageJson, "utf8");
  writeFileSync(
    path.join(options.destinationRoot, "README.md"),
    buildConsumerReadme({
      projectName: options.projectName,
      atlasVersion: options.atlasVersion,
    }),
    "utf8"
  );
  writeFileSync(
    path.join(options.destinationRoot, "jest.config.js"),
    buildConsumerJestConfig(),
    "utf8"
  );

  normalizeGeneratedInfrastructureManifest(options.destinationRoot);

  const manifestPath = path.join(
    options.destinationRoot,
    "templates",
    "app-infrastructure.manifest.json"
  );
  let contract = buildConsumerContract({
    repoRoot: options.destinationRoot,
  });

  if (existsSync(manifestPath)) {
    const manifest = loadAppInfrastructureManifest(options.destinationRoot);
    try {
      const baseline = captureConsumerPlatformBaseline({
        repoRoot: options.destinationRoot,
        applicationRoot: DEFAULT_ATLAS_PROJECT_CONTRACT.application.root,
        atlasVersion: options.atlasVersion,
        contractSchemaVersion: LATEST_SCHEMA_VERSION,
        manifest,
      });
      contract = mergePlatformBaselineIntoContract(contract, baseline);
    } catch (error) {
      if (error instanceof AtlasBaselineCaptureError) {
        throw new CliError(CliErrorCode.PREREQUISITE_ERROR, error.message, { cause: error });
      }
      throw error;
    }
  }

  try {
    resolveAtlasProject(options.destinationRoot, contract);
  } catch (error) {
    throw cliErrorFromContract(error);
  }

  writeFileSync(
    path.join(options.destinationRoot, ATLAS_CONTRACT_FILENAME),
    `${JSON.stringify(contract, null, 2)}\n`,
    "utf8"
  );

  const envAction = maybeCopyEnvLocal(options.destinationRoot, options.env);
  const planned = planGeneratedAtInitActions(options.env).map((action) =>
    action.path === envAction.path ? envAction : action
  );
  return planned;
}

function promoteStaging(options: {
  stagingRoot: string;
  destination: string;
  existedEmpty: boolean;
}): void {
  if (existsSync(options.destination)) {
    if (options.existedEmpty) {
      rmdirSync(options.destination);
    } else {
      throw new CliError(
        CliErrorCode.BOOTSTRAP_CONFLICT,
        `Destination "${options.destination}" appeared during init and is no longer available.`
      );
    }
  }

  renameSync(options.stagingRoot, options.destination);
}

export function runBootstrapInit(options: BootstrapInitOptions): CommandResult {
  if (options.reference === "remove") {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "--reference remove applies to checkout init only. Empty-directory bootstrap does not include apps/reference."
    );
  }

  const destination = resolveBootstrapDestination(options.cwd, options.project);
  const projectName = bootstrapProjectName(destination.relativePath);
  const assetRoot = options.assetRoot ?? findBootstrapAssetRoot();
  const manifest = loadVerifiedBootstrapManifest(assetRoot);
  const atlasVersion = manifest.atlasVersion;
  const generatedActions = planGeneratedAtInitActions(options.env);
  const actions: PlannedAction[] = [
    {
      kind: "create",
      path: destination.relativePath,
      reason: `Materialize ${manifest.entries.length} packaged bootstrap files`,
    },
    ...generatedActions,
  ];

  const plan: CommandResult = {
    repoRoot: destination.absolutePath,
    atlasVersion,
    initMode: "bootstrap",
    actions,
    warnings: [],
    alreadyInitialized: false,
    referencePolicy: options.reference,
  };

  if (options.dryRun) {
    return plan;
  }

  const createdParents = ensureDestinationParent(destination.absolutePath, destination.cwd);
  const stagingRoot = mkdtempSync(
    path.join(path.dirname(destination.absolutePath), `.${projectName}.atlas-init-`)
  );

  try {
    const filesRoot = packagedBootstrapFilesRoot(assetRoot);
    materializePackagedFiles(filesRoot, stagingRoot, manifest);
    plan.actions = [
      {
        kind: "create",
        path: destination.relativePath,
        reason: `Materialize ${manifest.entries.length} packaged bootstrap files`,
      },
      ...writeGeneratedFiles({
        destinationRoot: stagingRoot,
        projectName,
        atlasVersion,
        env: options.env,
      }),
    ];
    plan.warnings = validatePrerequisites(stagingRoot);
    options.beforePromote?.();
    promoteStaging({
      stagingRoot,
      destination: destination.absolutePath,
      existedEmpty: destination.existedEmpty,
    });
  } catch (error) {
    rmSync(stagingRoot, { recursive: true, force: true });
    if (destination.existedEmpty && !existsSync(destination.absolutePath)) {
      mkdirSync(destination.absolutePath);
    }
    if (!destination.existedEmpty && existsSync(destination.absolutePath)) {
      // Promote never happened; destination should still be absent.
    }
    removeEmptyDirectories(createdParents);
    throw error;
  }

  return plan;
}
