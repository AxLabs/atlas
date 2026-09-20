#!/usr/bin/env node
/**
 * Post-publication smoke test against the public npm registry.
 *
 * This never falls back to a local tarball. If the requested version is not on
 * npm, the command fails closed.
 */

import { existsSync } from "node:fs";
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
  generatedProjectPnpmArgs,
  isCiEnvironment,
  isExplicitKeepRequested,
  parseJsonEnvelope,
  readGeneratedBaseline,
  resolveAtlasRepoRoot,
  resolveCommandPath,
  resolveGeneratedProjectPnpm,
  runStage,
  sanitizeCleanRoomEnv,
} from "./lib/distribution-clean-room.mjs";
import {
  assertInstalledRegistryPackage,
  assertRegistryInstallSpecifier,
  collectRegistryFallbackIssues,
  parseRegistryVersionArgument,
  registryInstallSpecifier,
} from "./lib/distribution-registry.mjs";
import { NPM_REGISTRY_URL, queryNpmPackageVersion } from "./lib/npm-publication.mjs";

const scriptPath = fileURLToPath(import.meta.url);

function writeHelp() {
  process.stdout.write(`Usage: pnpm distribution:verify-registry <version> [--keep]

Install @blitzcraftlabs/atlas@<version> from the npm registry into a temporary
directory outside this checkout, then run:

  atlas --version
  atlas init test-app
  pnpm install
  pnpm build
  atlas doctor
  atlas generate / atlas context

This check fails closed when the version is not on npm. It does not fall back
to a local tarball and does not publish.
`);
}

function parseArgs(argv) {
  const options = {
    keep: isExplicitKeepRequested({ argv, env: process.env }),
    help: false,
    version: null,
    retries: 0,
    retryWaitMs: 10_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--keep") {
      options.keep = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--retries") {
      const raw = argv[index + 1];
      if (!/^\d+$/.test(raw ?? "")) {
        throw new Error("--retries requires a non-negative integer");
      }
      options.retries = Number(raw);
      if (options.retries > 30) {
        throw new Error("--retries must be <= 30");
      }
      index += 1;
    } else if (arg === "--retry-wait-ms") {
      const raw = argv[index + 1];
      if (!/^\d+$/.test(raw ?? "")) {
        throw new Error("--retry-wait-ms requires a non-negative integer");
      }
      options.retryWaitMs = Number(raw);
      if (options.retryWaitMs > 60_000) {
        throw new Error("--retry-wait-ms must be <= 60000");
      }
      index += 1;
    } else if (options.version === null) {
      options.version = parseRegistryVersionArgument(arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function queryPublishedVersion(version, retries, retryWaitMs) {
  let registry;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    registry = await queryNpmPackageVersion({ version });
    if (registry.packageExists && registry.versionExists) {
      return registry;
    }
    if (attempt < retries) {
      process.stdout.write(
        `${CLEAN_ROOM_STAGE_PREFIX} waiting for npm ${PUBLIC_CLI_PACKAGE_NAME}@${version} (attempt ${attempt + 1}/${retries + 1})\n`
      );
      await sleep(retryWaitMs);
    }
  }
  return registry;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    writeHelp();
    return 0;
  }
  if (!options.version) {
    throw new Error("Missing version. Usage: pnpm distribution:verify-registry <version>");
  }

  const fallbackIssues = collectRegistryFallbackIssues(process.env);
  if (fallbackIssues.length > 0) {
    throw new Error(
      `Registry verification refuses offline/local fallback:\n${fallbackIssues.join("\n")}`
    );
  }

  const registry = await queryPublishedVersion(
    options.version,
    options.retries,
    options.retryWaitMs
  );
  if (!registry?.packageExists || !registry.versionExists) {
    throw new Error(
      `${PUBLIC_CLI_PACKAGE_NAME}@${options.version} is not on npm (${registry?.status ?? "unknown"}). Registry verification does not fall back to a local tarball.`
    );
  }

  const repoRoot = resolveAtlasRepoRoot(path.dirname(scriptPath));
  const pnpm = resolveCommandPath("pnpm");
  const specifier = registryInstallSpecifier(options.version);
  assertRegistryInstallSpecifier(specifier);

  let layout;
  let failed = false;
  try {
    layout = createCleanRoomLayout(repoRoot);
    const harnessEnv = sanitizeCleanRoomEnv({ repoRoot, cwd: layout.harness });
    runStage(
      CLEAN_ROOM_STAGES.installCli,
      pnpm,
      ["add", specifier, "--registry", NPM_REGISTRY_URL],
      {
        cwd: layout.harness,
        env: harnessEnv,
        timeout: CLEAN_ROOM_TIMEOUTS_MS.installCli,
      }
    );

    const installed = assertInstalledRegistryPackage({
      harness: layout.harness,
      version: options.version,
      repoRoot,
    });
    const atlas = installed.atlasBin;

    const version = runStage(CLEAN_ROOM_STAGES.installCli, atlas, ["--version"], {
      cwd: layout.harness,
      env: sanitizeCleanRoomEnv({ repoRoot, cwd: layout.harness }),
      timeout: CLEAN_ROOM_TIMEOUTS_MS.init,
    });
    if (version.stdout.trim() !== options.version) {
      throw new Error(
        `atlas --version is ${version.stdout.trim()}, expected ${options.version} from npm`
      );
    }

    runStage(CLEAN_ROOM_STAGES.init, atlas, ["init", GENERATED_PROJECT_NAME], {
      cwd: layout.root,
      env: sanitizeCleanRoomEnv({ repoRoot, cwd: layout.root }),
      timeout: CLEAN_ROOM_TIMEOUTS_MS.init,
    });

    const generatedRoot = layout.generatedRoot;
    if (!existsSync(generatedRoot)) {
      throw new Error(`atlas init did not create ${generatedRoot}`);
    }
    assertOutsideRepo(repoRoot, generatedRoot, "Generated project");
    const generatedManifest = assertGeneratedProjectShape(generatedRoot, repoRoot);
    const atlasVersion = readGeneratedBaseline(generatedRoot);
    if (atlasVersion !== options.version) {
      throw new Error(
        `Generated Atlas baseline is ${atlasVersion}, expected registry version ${options.version}`
      );
    }
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
    const consumerPnpm = resolveGeneratedProjectPnpm({
      generatedRoot,
      env: consumerEnv,
    });
    process.stdout.write(
      `${CLEAN_ROOM_STAGE_PREFIX} consumer pnpm@${consumerPnpm.version} via ${consumerPnpm.source}\n`
    );
    runStage(
      CLEAN_ROOM_STAGES.installConsumer,
      consumerPnpm.command,
      generatedProjectPnpmArgs(consumerPnpm, ["install"]),
      {
        cwd: generatedRoot,
        env: consumerEnv,
        timeout: CLEAN_ROOM_TIMEOUTS_MS.installConsumer,
      }
    );
    const workspaceIssues = auditGeneratedWorkspace(generatedRoot);
    if (workspaceIssues.length > 0) {
      throw new Error(`Generated workspace audit failed:\n${workspaceIssues.join("\n")}`);
    }
    const resolutionIssues = collectWorkspaceResolutionIssues(generatedRoot);
    if (resolutionIssues.length > 0) {
      throw new Error(`Generated workspace resolution failed:\n${resolutionIssues.join("\n")}`);
    }

    runStage(
      CLEAN_ROOM_STAGES.build,
      consumerPnpm.command,
      generatedProjectPnpmArgs(consumerPnpm, ["build"]),
      {
        cwd: generatedRoot,
        env: sanitizeCleanRoomEnv({
          repoRoot,
          cwd: generatedRoot,
          extra: { ...CONSUMER_BUILD_ENV, ...consumerToolingEnv },
        }),
        timeout: CLEAN_ROOM_TIMEOUTS_MS.build,
      }
    );

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
      `${CLEAN_ROOM_STAGE_PREFIX} ok registry ${PUBLIC_CLI_PACKAGE_NAME}@${options.version}\n`
    );
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
  }

  if (layout?.root) {
    const retention = finalizeCleanRoom({
      root: layout.root,
      explicitKeep: options.keep,
      isCi: isCiEnvironment(process.env),
      failed,
    });
    if (retention.cleanupError) {
      process.stderr.write(
        `${CLEAN_ROOM_STAGE_PREFIX} cleanup failed ${layout.root}: ${retention.cleanupError.message}\n`
      );
      return 1;
    }
  }

  return failed ? 1 : 0;
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
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
