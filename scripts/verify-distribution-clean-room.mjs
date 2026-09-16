#!/usr/bin/env node
import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PUBLIC_CLI_PACKAGE_NAME } from "./atlas-workspaces.mjs";
import {
  CLEAN_ROOM_STAGE_PREFIX,
  CLEAN_ROOM_STAGES,
  CLEAN_ROOM_TIMEOUTS_MS,
  CONSUMER_BUILD_ENV,
  GENERATED_PROJECT_NAME,
  GENERATOR_FEATURE_NAME,
  GENERATOR_PAGE_ROUTE,
  assertContextReport,
  assertDoctorReport,
  assertGeneratedProjectShape,
  assertGeneratorOutput,
  assertOutsideRepo,
  auditGeneratedWorkspace,
  collectWorkspaceResolutionIssues,
  createCleanRoomLayout,
  finalizeCleanRoom,
  findPackedTarball,
  isCiEnvironment,
  isExplicitKeepRequested,
  isInsideDirectory,
  parseJsonEnvelope,
  readGeneratedBaseline,
  resolveAtlasRepoRoot,
  resolveCommandPath,
  runStage,
  sanitizeCleanRoomEnv,
} from "./lib/distribution-clean-room.mjs";
import { verifyNpmPublishDryRun } from "./lib/npm-publish-dry-run.mjs";

const scriptPath = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const options = {
    keep: isExplicitKeepRequested({ argv, env: process.env }),
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--keep") {
      options.keep = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function writeHelp() {
  process.stdout.write(`Usage: pnpm distribution:verify [--keep]

Prove that a packed @blitzcraftlabs/atlas tarball bootstraps a self-contained Atlas project
outside this repository.

--keep (or ATLAS_KEEP_CLEAN_ROOM=1) preserves the temporary directory on
success and failure. Without it, local failures keep the directory for
debugging; CI (CI=true) always removes it.

This is a maintainer distribution check. It does not publish to npm.
`);
}

function installedAtlasBinary(harness) {
  return path.join(harness, "node_modules", ".bin", "atlas");
}

function installedCliPackage(harness) {
  return path.join(harness, "node_modules", "@blitzcraftlabs", "atlas");
}

function assertExecutable(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} is missing: ${filePath}`);
  }
  if ((statSync(filePath).mode & 0o111) === 0) {
    throw new Error(`${label} is not executable: ${filePath}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    writeHelp();
    return 0;
  }

  const repoRoot = resolveAtlasRepoRoot(path.dirname(scriptPath));
  const pnpm = resolveCommandPath("pnpm");
  const cliPackageRoot = path.join(repoRoot, "packages", "cli");
  let layout;
  let failed = false;

  try {
    layout = createCleanRoomLayout(repoRoot);
    const packEnv = {
      ...process.env,
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    };

    runStage(CLEAN_ROOM_STAGES.packCli, pnpm, ["--filter", PUBLIC_CLI_PACKAGE_NAME, "build"], {
      cwd: repoRoot,
      env: packEnv,
      timeout: CLEAN_ROOM_TIMEOUTS_MS.packCli,
    });
    process.stdout.write(`${CLEAN_ROOM_STAGE_PREFIX} ${CLEAN_ROOM_STAGES.npmPublishDryRun}\n`);
    try {
      verifyNpmPublishDryRun({ packageRoot: cliPackageRoot, env: packEnv });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${CLEAN_ROOM_STAGE_PREFIX} FAILED ${CLEAN_ROOM_STAGES.npmPublishDryRun}\n${message}`);
    }
    runStage(CLEAN_ROOM_STAGES.packCli, pnpm, ["pack", "--pack-destination", layout.artifacts], {
      cwd: cliPackageRoot,
      env: packEnv,
      timeout: CLEAN_ROOM_TIMEOUTS_MS.packCli,
    });

    const tarballPath = findPackedTarball(layout.artifacts);
    if (!existsSync(tarballPath)) {
      throw new Error(`Packed CLI tarball was not created at ${tarballPath}`);
    }

    const harnessEnv = sanitizeCleanRoomEnv({ repoRoot, cwd: layout.harness });
    runStage(CLEAN_ROOM_STAGES.installCli, pnpm, ["add", tarballPath], {
      cwd: layout.harness,
      env: harnessEnv,
      timeout: CLEAN_ROOM_TIMEOUTS_MS.installCli,
    });

    const atlasBin = installedAtlasBinary(layout.harness);
    const cliInstalled = installedCliPackage(layout.harness);
    assertExecutable(atlasBin, "Installed Atlas binary");
    assertOutsideRepo(repoRoot, layout.harness, "Clean-room harness");
    assertOutsideRepo(repoRoot, atlasBin, "Installed Atlas binary");
    assertOutsideRepo(repoRoot, cliInstalled, `Installed ${PUBLIC_CLI_PACKAGE_NAME}`);
    if (isInsideDirectory(cliPackageRoot, cliInstalled)) {
      throw new Error("Installed CLI resolved to the source-tree package");
    }

    const atlas = realpathSync(atlasBin);
    const initEnv = sanitizeCleanRoomEnv({ repoRoot, cwd: layout.root });
    runStage(CLEAN_ROOM_STAGES.init, atlas, ["init", GENERATED_PROJECT_NAME], {
      cwd: layout.root,
      env: initEnv,
      timeout: CLEAN_ROOM_TIMEOUTS_MS.init,
    });

    const generatedRoot = layout.generatedRoot;
    if (!existsSync(generatedRoot)) {
      throw new Error(`atlas init did not create ${generatedRoot}`);
    }
    assertOutsideRepo(repoRoot, generatedRoot, "Generated project");
    const generatedManifest = assertGeneratedProjectShape(generatedRoot, repoRoot);
    const atlasVersion = readGeneratedBaseline(generatedRoot);
    if (generatedManifest.version === atlasVersion) {
      throw new Error("Generated app version must remain independent of the Atlas baseline");
    }

    const consumerToolingEnv = {
      TURBO_CACHE_DIR: path.join(generatedRoot, "node_modules", ".cache", "turbo"),
      TURBO_DAEMON: "false",
    };
    const consumerEnv = sanitizeCleanRoomEnv({
      repoRoot,
      cwd: generatedRoot,
      extra: consumerToolingEnv,
    });
    runStage(CLEAN_ROOM_STAGES.installConsumer, pnpm, ["install"], {
      cwd: generatedRoot,
      env: consumerEnv,
      timeout: CLEAN_ROOM_TIMEOUTS_MS.installConsumer,
    });
    if (!existsSync(path.join(generatedRoot, "pnpm-lock.yaml"))) {
      throw new Error("pnpm install did not create pnpm-lock.yaml");
    }
    const workspaceIssues = auditGeneratedWorkspace(generatedRoot);
    if (workspaceIssues.length > 0) {
      throw new Error(`Generated workspace audit failed:\n${workspaceIssues.join("\n")}`);
    }
    const resolutionIssues = collectWorkspaceResolutionIssues(generatedRoot);
    if (resolutionIssues.length > 0) {
      throw new Error(`Generated workspace resolution failed:\n${resolutionIssues.join("\n")}`);
    }

    const buildEnv = sanitizeCleanRoomEnv({
      repoRoot,
      cwd: generatedRoot,
      extra: { ...CONSUMER_BUILD_ENV, ...consumerToolingEnv },
    });
    runStage(CLEAN_ROOM_STAGES.build, pnpm, ["build"], {
      cwd: generatedRoot,
      env: buildEnv,
      timeout: CLEAN_ROOM_TIMEOUTS_MS.build,
    });

    const doctor = runStage(
      CLEAN_ROOM_STAGES.doctor,
      atlas,
      ["doctor", "--json", "--cwd", generatedRoot],
      {
        cwd: layout.harness,
        env: sanitizeCleanRoomEnv({ repoRoot, cwd: layout.harness }),
        timeout: CLEAN_ROOM_TIMEOUTS_MS.doctor,
      }
    );
    const doctorEnvelope = parseJsonEnvelope(doctor.stdout, "atlas doctor --json");
    const doctorIssues = assertDoctorReport(doctorEnvelope, {
      atlasVersion,
      appVersion: generatedManifest.version,
      generatedRoot,
      repoRoot,
    });
    if (doctorIssues.length > 0) {
      throw new Error(`Doctor assertions failed:\n${doctorIssues.join("\n")}\n${doctor.stdout}`);
    }

    runStage(
      CLEAN_ROOM_STAGES.generate,
      atlas,
      ["generate", "feature", GENERATOR_FEATURE_NAME, "--cwd", generatedRoot],
      {
        cwd: layout.harness,
        env: sanitizeCleanRoomEnv({ repoRoot, cwd: layout.harness }),
        timeout: CLEAN_ROOM_TIMEOUTS_MS.generate,
      }
    );
    runStage(
      CLEAN_ROOM_STAGES.generate,
      atlas,
      ["generate", "page", GENERATOR_PAGE_ROUTE, "--cwd", generatedRoot],
      {
        cwd: layout.harness,
        env: sanitizeCleanRoomEnv({ repoRoot, cwd: layout.harness }),
        timeout: CLEAN_ROOM_TIMEOUTS_MS.generate,
      }
    );
    assertGeneratorOutput(generatedRoot);

    runStage(CLEAN_ROOM_STAGES.typecheck, pnpm, ["typecheck"], {
      cwd: generatedRoot,
      env: sanitizeCleanRoomEnv({
        repoRoot,
        cwd: generatedRoot,
        extra: consumerToolingEnv,
      }),
      timeout: CLEAN_ROOM_TIMEOUTS_MS.typecheck,
    });

    const context = runStage(
      CLEAN_ROOM_STAGES.context,
      atlas,
      ["context", "--json", "--cwd", generatedRoot],
      {
        cwd: layout.harness,
        env: sanitizeCleanRoomEnv({ repoRoot, cwd: layout.harness }),
        timeout: CLEAN_ROOM_TIMEOUTS_MS.context,
      }
    );
    const contextEnvelope = parseJsonEnvelope(context.stdout, "atlas context --json");
    const contextIssues = assertContextReport(contextEnvelope, {
      atlasVersion,
      generatedRoot,
      repoRoot,
    });
    if (contextIssues.length > 0) {
      throw new Error(`Context assertions failed:\n${contextIssues.join("\n")}\n${context.stdout}`);
    }

    process.stdout.write(
      `${CLEAN_ROOM_STAGE_PREFIX} ok ${GENERATED_PROJECT_NAME} @ Atlas ${atlasVersion}\n`
    );
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
  }

  if (layout?.root) {
    const cleanupFailed = reportCleanRoomRetention({
      root: layout.root,
      explicitKeep: options.keep,
      failed,
    });
    if (cleanupFailed) {
      return 1;
    }
  }

  return failed ? 1 : 0;
}

/**
 * @param {{
 *   root: string;
 *   explicitKeep: boolean;
 *   failed: boolean;
 * }} options
 * @returns {boolean} true when directory removal failed
 */
function reportCleanRoomRetention(options) {
  const write = options.failed
    ? (message) => process.stderr.write(message)
    : (message) => process.stdout.write(message);
  const retention = finalizeCleanRoom({
    root: options.root,
    explicitKeep: options.explicitKeep,
    isCi: isCiEnvironment(process.env),
    failed: options.failed,
    write,
  });
  if (!retention.cleanupError) {
    return false;
  }
  process.stderr.write(
    `${CLEAN_ROOM_STAGE_PREFIX} cleanup failed ${options.root}: ${retention.cleanupError.message}\n`
  );
  return true;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(scriptPath).href
) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
      );
      process.exitCode = 1;
    });
}
