#!/usr/bin/env node
/**
 * Apply a fail-closed Atlas GitHub Release publication decision.
 *
 * Dry-run (default for rehearsal) verifies version, changelog, tag name, SBOM,
 * and release notes without creating a Git tag or GitHub Release.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { generateSpdxSbom } from "./generate-sbom.mjs";
import {
  PublicationError,
  REQUIRED_RELEASE_CHECK_WORKFLOWS,
  buildCanonicalReleaseNotes,
  evaluatePublicationDecision,
  evaluateRequiredReleaseChecks,
  isFirstCanonicalPublicRelease,
  publicationSideEffects,
  readPublicationInputs,
  sbomAssetNameForCommit,
  tagNameForVersion,
} from "./release-publication.mjs";

function parseArgs(argv) {
  const options = {
    dryRun: false,
    skipGithub: false,
    skipChecks: false,
    repoRoot: process.cwd(),
    stateFile: null,
    outputDir: null,
    ownerRepo: process.env.GITHUB_REPOSITORY ?? "blitzcraftlabs/atlas",
    targetSha: process.env.GITHUB_SHA ?? null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--skip-github") {
      options.skipGithub = true;
    } else if (arg === "--skip-checks") {
      options.skipChecks = true;
    } else if (arg === "--repo-root") {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else if (arg === "--state-file") {
      options.stateFile = argv[index + 1];
      index += 1;
    } else if (arg === "--output-dir") {
      options.outputDir = argv[index + 1];
      index += 1;
    } else if (arg === "--owner-repo") {
      options.ownerRepo = argv[index + 1];
      index += 1;
    } else if (arg === "--target-sha") {
      options.targetSha = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

function runGh(args, options) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    cwd: options.repoRoot,
    env: process.env,
  }).trim();
}

function runGit(args, options) {
  return execFileSync("git", args, {
    encoding: "utf8",
    cwd: options.repoRoot,
    env: process.env,
  }).trim();
}

function loadGithubState(options) {
  if (options.stateFile) {
    return JSON.parse(readFileSync(options.stateFile, "utf8"));
  }

  if (options.skipGithub) {
    return {
      existingTags: [],
      existingReleases: [],
      canonicalMainSha: options.targetSha,
    };
  }

  const [owner, repo] = options.ownerRepo.split("/");
  const tagsJson = runGh(["api", `repos/${owner}/${repo}/tags`, "--paginate"], options);
  const releasesJson = runGh(["api", `repos/${owner}/${repo}/releases`, "--paginate"], options);
  const mainJson = runGh(["api", `repos/${owner}/${repo}/commits/main`], options);

  const tags = JSON.parse(tagsJson || "[]");
  const releases = JSON.parse(releasesJson || "[]");
  const main = JSON.parse(mainJson);
  const existingTags = tags.map((tag) => ({
    name: tag.name,
    sha: tag.commit?.sha ?? null,
  }));

  return {
    existingTags,
    existingReleases: releases.map((release) => ({
      tagName: release.tag_name,
      sha: resolveReleaseSha(release, existingTags),
      assets: (release.assets ?? []).map((asset) => asset.name).filter(Boolean),
    })),
    canonicalMainSha: main.sha,
  };
}

function isGitCommitSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}

function resolveReleaseSha(release, existingTags) {
  const target = release.target_commitish ?? null;
  if (isGitCommitSha(target)) {
    return target;
  }

  const matchingTag = existingTags.find((entry) => entry.name === release.tag_name);
  return matchingTag?.sha ?? null;
}

function writeSbom(repoRoot, commitSha, outputDir) {
  const sbom = generateSpdxSbom({ root: repoRoot, commitSha });
  const fileName = sbomAssetNameForCommit(commitSha);
  const filePath = path.join(outputDir, fileName);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(sbom, null, 2)}\n`);
  return { fileName, filePath, packageCount: sbom.packages.length };
}

function waitForRequiredChecks(options, sha) {
  const timeoutMs = Number(process.env.ATLAS_RELEASE_CHECK_TIMEOUT_MS ?? 25 * 60 * 1000);
  const pollMs = Number(process.env.ATLAS_RELEASE_CHECK_POLL_MS ?? 30_000);
  const started = Date.now();
  const required = new Set(REQUIRED_RELEASE_CHECK_WORKFLOWS);

  while (Date.now() - started < timeoutMs) {
    const raw = runGh(
      [
        "run",
        "list",
        "--repo",
        options.ownerRepo,
        "--commit",
        sha,
        "--json",
        "name,conclusion,status,headSha,workflowName",
      ],
      options
    );
    const runs = JSON.parse(raw || "[]");
    const { failed, pending } = evaluateRequiredReleaseChecks(runs, {
      requiredWorkflows: [...required],
      commitSha: sha,
    });
    if (failed.length > 0) {
      throw new PublicationError(
        `Required checks failed: ${failed.map((run) => `${run.name}=${run.conclusion}`).join(", ")}`,
        { code: "CHECKS_FAILED" }
      );
    }

    if (pending.length === 0) {
      return;
    }

    process.stdout.write(`Waiting for required checks: ${pending.join(", ")}\n`);
    execFileSync("sleep", [String(Math.ceil(pollMs / 1000))], { stdio: "ignore" });
  }

  throw new PublicationError(`Timed out waiting for required checks: ${[...required].join(", ")}`, {
    code: "CHECKS_TIMEOUT",
  });
}

function createGitTag(options, tag, sha) {
  runGit(["tag", "-a", tag, sha, "-m", `Atlas ${tag.slice(1)}`], options);
  runGit(["push", "origin", tag], options);
}

function uploadCanonicalReleaseAssets(options, tag, sbomPath, { clobber }) {
  const sbomArgs = ["release", "upload", tag, sbomPath, "--repo", options.ownerRepo];
  if (clobber) {
    sbomArgs.push("--clobber");
  }
  runGh(sbomArgs, options);

  const licensePath = path.join(options.repoRoot, "LICENSE");
  if (existsSync(licensePath)) {
    const licenseArgs = ["release", "upload", tag, licensePath, "--repo", options.ownerRepo];
    if (clobber) {
      licenseArgs.push("--clobber");
    }
    runGh(licenseArgs, options);
  }
}

function createGithubRelease(options, decision, notesPath, sbomPath) {
  const args = [
    "release",
    "create",
    decision.tag,
    "--repo",
    options.ownerRepo,
    "--target",
    options.targetSha,
    "--title",
    `Atlas ${decision.version}`,
    "--notes-file",
    notesPath,
  ];
  if (decision.prerelease) {
    args.push("--prerelease");
  }
  runGh(args, options);
  uploadCanonicalReleaseAssets(options, decision.tag, sbomPath, { clobber: false });
}

export function preparePublication(options) {
  const inputs = readPublicationInputs(options.repoRoot);
  const githubState = loadGithubState(options);
  const targetSha = options.targetSha ?? githubState.canonicalMainSha;
  if (!targetSha) {
    throw new PublicationError("Missing target SHA for publication", { code: "MISSING_SHA" });
  }

  const decision = evaluatePublicationDecision({
    ...inputs,
    proposedTag: tagNameForVersion(inputs.rootVersion),
    existingTags: githubState.existingTags,
    existingReleases: githubState.existingReleases,
    targetSha,
    canonicalMainSha: githubState.canonicalMainSha ?? targetSha,
  });

  const outputDir = options.outputDir ?? path.join(options.repoRoot, "artifacts");
  const sbom = writeSbom(options.repoRoot, targetSha, outputDir);
  const notes = buildCanonicalReleaseNotes(inputs.changelog, inputs.rootVersion, {
    commitSha: targetSha,
    sbomFileName: sbom.fileName,
    firstCanonicalPublicRelease: isFirstCanonicalPublicRelease(githubState),
  });
  const notesPath = path.join(outputDir, `atlas-release-notes-${inputs.rootVersion}.md`);
  writeFileSync(notesPath, notes);

  return {
    decision,
    inputs,
    githubState,
    targetSha,
    sbom,
    notesPath,
    notes,
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  try {
    const prepared = preparePublication(options);
    const { decision, targetSha, sbom, notesPath } = prepared;

    process.stdout.write(
      [
        `Release decision: ${decision.action}`,
        `  Version: ${decision.version}`,
        `  Tag: ${decision.tag}`,
        `  SHA: ${targetSha}`,
        `  Reason: ${decision.reason}`,
        `  SBOM: ${sbom.filePath} (${sbom.packageCount} packages)`,
        `  Notes: ${notesPath}`,
        options.dryRun
          ? "  Mode: dry-run (no tag or GitHub Release will be created)"
          : "  Mode: live",
        "",
      ].join("\n")
    );

    if (decision.action === "noop") {
      process.stdout.write("✓ No publication required\n");
      return;
    }

    if (options.dryRun) {
      process.stdout.write("✓ Publication prerequisites satisfied (dry-run)\n");
      return;
    }

    if (!options.skipChecks) {
      waitForRequiredChecks(options, targetSha);
    }

    const effects = publicationSideEffects(decision.action);
    if (effects.createTag) {
      createGitTag(options, decision.tag, targetSha);
    }
    if (effects.createRelease) {
      createGithubRelease(options, decision, notesPath, sbom.filePath);
    } else if (effects.uploadAssets) {
      uploadCanonicalReleaseAssets(options, decision.tag, sbom.filePath, {
        clobber: effects.clobberExactAssets,
      });
    }
    process.stdout.write(`✓ Published ${decision.tag}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Publication failed: ${message}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
