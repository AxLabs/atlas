import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  findCapabilitiesAssetRoot,
  readCapabilitiesManifest,
  resolveCapabilityFile,
} from "../bootstrap/capability-assets";
import { sha256Bytes } from "../bootstrap/checksum";
import { createAtlasContext } from "../context/atlas-context";
import { detectWorkspaceKind } from "../context/workspace-kind";
import { CliError, CliErrorCode } from "../errors/cli-error";

import {
  applyCanonicalChromeFlags,
  CUSTOM_CHROME_FLAGS_REASON,
  getLighthouseCollectSettings,
  LEGACY_CHROME_FLAGS_REASON,
  LIGHTHOUSERC_DESTINATION,
  observeLighthouseChromeFlags,
} from "./lighthouse-chrome-flags";
import { generatedFilesForCapability } from "./patches";
import { getCapabilityDefinition, listCapabilityDefinitions } from "./registry";

import type { PlannedAction } from "../types/result";
import type { CapabilityDefinition, CapabilityId, PackagedCapability } from "./types";

export type CapabilityInstallStatus =
  | "absent"
  | "partial"
  | "installed"
  | "conflicted"
  | "replaceable";

export interface EnableResult {
  repoRoot: string;
  atlasVersion: string;
  capability: string;
  actions: PlannedAction[];
  warnings: { code: string; message: string }[];
}

export interface CapabilityListEntry {
  id: string;
  title: string;
  description: string;
  tier: string;
  heavier: boolean;
  requires: string[];
  status: CapabilityInstallStatus;
  /**
   * True only when packaged/generated files and package keys match.
   * Does not mean `validationCommand` passed.
   */
  filesMatch: boolean;
  validationCommand: string;
}

export interface EnableListResult {
  repoRoot: string;
  atlasVersion: string;
  workspaceKind: ReturnType<typeof detectWorkspaceKind>;
  statusMeaning: string;
  capabilities: CapabilityListEntry[];
}

interface DeferredWrite {
  action: PlannedAction;
  apply: () => void;
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureParent(filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

function bytesEqual(left: Buffer, right: Buffer): boolean {
  return left.equals(right);
}

function tryCapabilitiesAssetRoot(explicit?: string): string | undefined {
  if (explicit) {
    return explicit;
  }
  try {
    return findCapabilitiesAssetRoot();
  } catch {
    return undefined;
  }
}

function mergeStringRecord(options: {
  existing: Record<string, string>;
  patch: Record<string, string>;
  destination: string;
  field: string;
}): { next: Record<string, string>; actions: PlannedAction[]; dirty: boolean } {
  const next = { ...options.existing };
  const actions: PlannedAction[] = [];
  let dirty = false;
  for (const [key, value] of Object.entries(options.patch)) {
    const current = options.existing[key];
    if (current === undefined) {
      next[key] = value;
      dirty = true;
      actions.push({
        kind: "create",
        path: `${options.destination}#${options.field}.${key}`,
        reason: `Add ${options.field} ${key}`,
      });
      continue;
    }
    if (current === value) {
      actions.push({
        kind: "skip",
        path: `${options.destination}#${options.field}.${key}`,
        reason: "Already matches Atlas capability value",
      });
      continue;
    }
    actions.push({
      kind: "conflict",
      path: `${options.destination}#${options.field}.${key}`,
      reason: `Consumer ${options.field} differs; not overwritten`,
    });
  }
  return { next, actions, dirty };
}

function planPackagePatch(options: {
  repoRoot: string;
  patch: {
    path: string;
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
    pnpmOverrides?: Record<string, string>;
  };
}): DeferredWrite[] {
  const destinationPath = path.join(options.repoRoot, options.patch.path);
  if (!existsSync(destinationPath)) {
    return [
      {
        action: {
          kind: "conflict",
          path: options.patch.path,
          reason: "Package manifest is missing",
        },
        apply: () => undefined,
      },
    ];
  }

  const manifest = readJson(destinationPath);
  const actions: PlannedAction[] = [];
  let dirty = false;

  if (options.patch.scripts) {
    const current = (manifest.scripts as Record<string, string> | undefined) ?? {};
    const merged = mergeStringRecord({
      existing: current,
      patch: options.patch.scripts,
      destination: options.patch.path,
      field: "scripts",
    });
    actions.push(...merged.actions);
    if (merged.dirty) {
      manifest.scripts = merged.next;
      dirty = true;
    }
  }

  if (options.patch.devDependencies) {
    const current = (manifest.devDependencies as Record<string, string> | undefined) ?? {};
    const merged = mergeStringRecord({
      existing: current,
      patch: options.patch.devDependencies,
      destination: options.patch.path,
      field: "devDependencies",
    });
    actions.push(...merged.actions);
    if (merged.dirty) {
      manifest.devDependencies = merged.next;
      dirty = true;
    }
  }

  if (options.patch.pnpmOverrides) {
    const pnpm = (manifest.pnpm as { overrides?: Record<string, string> } | undefined) ?? {};
    const current = pnpm.overrides ?? {};
    const merged = mergeStringRecord({
      existing: current,
      patch: options.patch.pnpmOverrides,
      destination: options.patch.path,
      field: "pnpm.overrides",
    });
    actions.push(...merged.actions);
    if (merged.dirty) {
      manifest.pnpm = { ...pnpm, overrides: merged.next };
      dirty = true;
    }
  }

  const apply = dirty
    ? () => {
        writeJson(destinationPath, manifest);
      }
    : () => undefined;

  const firstCreate = actions.findIndex((action) => action.kind === "create");
  return actions.map((action, index) => ({
    action,
    apply: index === firstCreate && firstCreate >= 0 ? apply : () => undefined,
  }));
}

function planGeneratedFile(options: {
  repoRoot: string;
  destination: string;
  content: string;
  isReplaceable?: (existing: string) => boolean;
}): DeferredWrite {
  const absolutePath = path.join(options.repoRoot, options.destination);
  if (!existsSync(absolutePath)) {
    return {
      action: {
        kind: "create",
        path: options.destination,
        reason: "Write generated consumer file",
      },
      apply: () => {
        ensureParent(absolutePath);
        writeFileSync(absolutePath, options.content, "utf8");
      },
    };
  }

  const existing = readFileSync(absolutePath, "utf8");
  if (existing === options.content) {
    return {
      action: { kind: "skip", path: options.destination, reason: "Already current" },
      apply: () => undefined,
    };
  }
  if (options.isReplaceable?.(existing)) {
    return {
      action: {
        kind: "copy",
        path: options.destination,
        reason: "Replace known shipped documentation (full-content checksum match)",
      },
      apply: () => {
        writeFileSync(absolutePath, options.content, "utf8");
      },
    };
  }
  return {
    action: {
      kind: "conflict",
      path: options.destination,
      reason: "Consumer-modified file was not overwritten",
    },
    apply: () => undefined,
  };
}

function planPackagedFile(options: {
  capabilityId: string;
  destination: string;
  mode: string;
  sha256: string;
  repoRoot: string;
  assetRoot: string;
}): DeferredWrite {
  const sourcePath = resolveCapabilityFile(
    options.capabilityId,
    options.destination,
    options.assetRoot
  );
  const bytes = readFileSync(sourcePath);
  if (sha256Bytes(bytes) !== options.sha256) {
    throw new CliError(
      CliErrorCode.PREREQUISITE_ERROR,
      `Checksum mismatch for capability asset ${options.capabilityId}:${options.destination}.`
    );
  }

  const destinationPath = path.join(options.repoRoot, options.destination);
  if (!existsSync(destinationPath)) {
    return {
      action: {
        kind: "create",
        path: options.destination,
        reason: "Copy packaged capability file",
      },
      apply: () => {
        ensureParent(destinationPath);
        writeFileSync(destinationPath, bytes);
        chmodSync(destinationPath, Number.parseInt(options.mode, 8));
      },
    };
  }

  const existing = readFileSync(destinationPath);
  if (bytesEqual(existing, bytes)) {
    return {
      action: { kind: "skip", path: options.destination, reason: "Already matches packaged asset" },
      apply: () => undefined,
    };
  }
  return {
    action: {
      kind: "conflict",
      path: options.destination,
      reason: "Consumer-modified file was not overwritten",
    },
    apply: () => undefined,
  };
}

function planLighthouseChromeFlags(repoRoot: string): DeferredWrite {
  const destination = LIGHTHOUSERC_DESTINATION;
  const absolutePath = path.join(repoRoot, destination);
  if (!existsSync(absolutePath)) {
    return {
      action: {
        kind: "conflict",
        path: destination,
        reason: "lighthouserc.json is missing; cannot adopt chromeFlags",
      },
      apply: () => undefined,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      action: {
        kind: "conflict",
        path: destination,
        reason: `lighthouserc.json is not valid JSON (${message})`,
      },
      apply: () => undefined,
    };
  }

  const settings = getLighthouseCollectSettings(parsed);
  if (!settings) {
    return {
      action: {
        kind: "conflict",
        path: destination,
        reason: "lighthouserc.json is missing ci.collect.settings; cannot adopt chromeFlags",
      },
      apply: () => undefined,
    };
  }

  const observation = observeLighthouseChromeFlags(parsed);
  if (observation === "match") {
    return {
      action: {
        kind: "skip",
        path: destination,
        reason: "chromeFlags already matches the Lighthouse CI string",
      },
      apply: () => undefined,
    };
  }
  if (observation === "replaceable") {
    const next = applyCanonicalChromeFlags(parsed);
    return {
      action: {
        kind: "copy",
        path: destination,
        reason: LEGACY_CHROME_FLAGS_REASON,
      },
      apply: () => {
        writeJson(absolutePath, next);
      },
    };
  }

  return {
    action: {
      kind: "conflict",
      path: destination,
      reason: CUSTOM_CHROME_FLAGS_REASON,
    },
    apply: () => undefined,
  };
}

function observePerfCiLighthouse(repoRoot: string): FileObservationState {
  const absolutePath = path.join(repoRoot, LIGHTHOUSERC_DESTINATION);
  if (!existsSync(absolutePath)) {
    return "missing";
  }
  try {
    return observeLighthouseChromeFlags(JSON.parse(readFileSync(absolutePath, "utf8")));
  } catch {
    return "conflict";
  }
}

function applyDeferredWrites(planned: DeferredWrite[], dryRun: boolean): PlannedAction[] {
  if (!dryRun) {
    for (const item of planned) {
      if (item.action.kind === "create" || item.action.kind === "copy") {
        item.apply();
      }
    }
  }
  return planned.map((item) => item.action);
}

function packagedForCapability(
  capabilityId: string,
  assetRoot: string | undefined
): PackagedCapability | undefined {
  if (!assetRoot) {
    return undefined;
  }
  const manifest = readCapabilitiesManifest(assetRoot);
  return manifest.capabilities.find((entry) => entry.id === capabilityId);
}

type FileObservationState = "missing" | "match" | "replaceable" | "conflict";

function deriveStatus(states: FileObservationState[]): CapabilityInstallStatus {
  if (states.length === 0) {
    return "absent";
  }
  const missing = states.filter((state) => state === "missing").length;
  const replaceable = states.filter((state) => state === "replaceable").length;
  const conflict = states.filter((state) => state === "conflict").length;
  if (conflict > 0) {
    return "conflicted";
  }
  if (missing === states.length) {
    return "absent";
  }
  if (replaceable > 0 && missing === 0) {
    return "replaceable";
  }
  if (missing > 0) {
    return "partial";
  }
  return "installed";
}

function observePackageKeys(options: {
  repoRoot: string;
  patch: PackagedCapability["packagePatches"][number];
}): FileObservationState[] {
  const destinationPath = path.join(options.repoRoot, options.patch.path);
  if (!existsSync(destinationPath)) {
    return ["missing"];
  }
  const manifest = readJson(destinationPath);
  const states: FileObservationState[] = [];
  const observe = (
    field: string,
    patch: Record<string, string> | undefined,
    current: Record<string, string>
  ) => {
    if (!patch) {
      return;
    }
    void field;
    for (const [key, value] of Object.entries(patch)) {
      const existing = current[key];
      if (existing === undefined) {
        states.push("missing");
      } else if (existing === value) {
        states.push("match");
      } else {
        states.push("conflict");
      }
    }
  };
  observe(
    "scripts",
    options.patch.scripts,
    (manifest.scripts as Record<string, string> | undefined) ?? {}
  );
  observe(
    "devDependencies",
    options.patch.devDependencies,
    (manifest.devDependencies as Record<string, string> | undefined) ?? {}
  );
  const pnpm = (manifest.pnpm as { overrides?: Record<string, string> } | undefined) ?? {};
  observe("pnpm.overrides", options.patch.pnpmOverrides, pnpm.overrides ?? {});
  return states;
}

export function inspectCapabilityStatus(options: {
  repoRoot: string;
  atlasVersion: string;
  capability: CapabilityDefinition;
  assetRoot?: string;
}): CapabilityInstallStatus {
  const states: FileObservationState[] = [];
  const assetRoot = tryCapabilitiesAssetRoot(options.assetRoot);

  if (options.capability.generated) {
    const generated = generatedFilesForCapability({
      capabilityId: options.capability.id,
      repoRoot: options.repoRoot,
      atlasVersion: options.atlasVersion,
    });
    for (const file of generated) {
      const absolutePath = path.join(options.repoRoot, file.destination);
      if (!existsSync(absolutePath)) {
        states.push("missing");
        continue;
      }
      const existing = readFileSync(absolutePath, "utf8");
      if (existing === file.content) {
        states.push("match");
      } else if (file.isReplaceable?.(existing)) {
        states.push("replaceable");
      } else {
        states.push("conflict");
      }
    }
  }

  const packaged = packagedForCapability(options.capability.id, assetRoot);
  if (packaged) {
    for (const entry of packaged.entries) {
      const destinationPath = path.join(options.repoRoot, entry.destination);
      if (!existsSync(destinationPath)) {
        states.push("missing");
        continue;
      }
      const existing = readFileSync(destinationPath);
      if (sha256Bytes(existing) === entry.sha256) {
        states.push("match");
      } else {
        states.push("conflict");
      }
    }
    for (const patch of packaged.packagePatches) {
      states.push(...observePackageKeys({ repoRoot: options.repoRoot, patch }));
    }
  } else if (!options.capability.generated) {
    const detectPath = path.join(options.repoRoot, options.capability.detectPath);
    states.push(existsSync(detectPath) ? "match" : "missing");
  }

  if (options.capability.id === "perf-ci") {
    states.push(observePerfCiLighthouse(options.repoRoot));
  }

  return deriveStatus(states);
}

export const CAPABILITY_STATUS_MEANING =
  "status reflects packaged/generated file layout and package.json keys. It does not mean validationCommand passed or that the tool is operational.";

export function listConsumerCapabilities(options: {
  cwd?: string;
  assetRoot?: string;
}): EnableListResult {
  const context = createAtlasContext({ cwd: options.cwd, requireProject: true });
  const kind = detectWorkspaceKind(context.repoRoot);
  return {
    repoRoot: context.repoRoot,
    atlasVersion: context.atlasVersion,
    workspaceKind: kind,
    statusMeaning: CAPABILITY_STATUS_MEANING,
    capabilities: listCapabilityDefinitions().map((capability) => {
      const status = inspectCapabilityStatus({
        repoRoot: context.repoRoot,
        atlasVersion: context.atlasVersion,
        capability,
        assetRoot: options.assetRoot,
      });
      return {
        id: capability.id,
        title: capability.title,
        description: capability.description,
        tier: capability.tier,
        heavier: capability.heavier,
        requires: capability.requires,
        status,
        filesMatch: status === "installed",
        validationCommand: capability.validationCommand,
      };
    }),
  };
}

function planCapability(options: {
  repoRoot: string;
  atlasVersion: string;
  definition: CapabilityDefinition;
  assetRoot?: string;
}): DeferredWrite[] {
  const planned: DeferredWrite[] = [];

  if (options.definition.generated) {
    const generated = generatedFilesForCapability({
      capabilityId: options.definition.id,
      repoRoot: options.repoRoot,
      atlasVersion: options.atlasVersion,
    });
    for (const file of generated) {
      planned.push(
        planGeneratedFile({
          repoRoot: options.repoRoot,
          destination: file.destination,
          content: file.content,
          isReplaceable: file.isReplaceable,
        })
      );
    }
  }

  if (options.definition.files.length > 0) {
    const assetRoot = options.assetRoot ?? findCapabilitiesAssetRoot();
    const packaged = packagedForCapability(options.definition.id, assetRoot);
    if (!packaged) {
      throw new CliError(
        CliErrorCode.PREREQUISITE_ERROR,
        `Packaged capability assets for ${options.definition.id} are missing.`
      );
    }

    for (const entry of packaged.entries) {
      planned.push(
        planPackagedFile({
          capabilityId: options.definition.id,
          destination: entry.destination,
          mode: entry.mode,
          sha256: entry.sha256,
          repoRoot: options.repoRoot,
          assetRoot,
        })
      );
    }

    for (const patch of packaged.packagePatches) {
      planned.push(...planPackagePatch({ repoRoot: options.repoRoot, patch }));
    }
  }

  if (options.definition.id === "perf-ci") {
    planned.push(planLighthouseChromeFlags(options.repoRoot));
  }

  return planned;
}

export function enableConsumerCapability(options: {
  cwd?: string;
  capability: string;
  dryRun?: boolean;
  assetRoot?: string;
}): EnableResult {
  const definition = getCapabilityDefinition(options.capability);
  if (!definition) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Unknown capability: ${options.capability}. Run atlas enable list --json.`
    );
  }

  const context = createAtlasContext({ cwd: options.cwd, requireProject: true });
  const repoRoot = context.repoRoot;
  const atlasVersion = context.atlasVersion;
  const dryRun = options.dryRun === true;
  const warnings: EnableResult["warnings"] = [];

  for (const required of definition.requires) {
    const requiredDefinition = getCapabilityDefinition(required);
    if (!requiredDefinition) {
      throw new CliError(
        CliErrorCode.USAGE_ERROR,
        `${definition.id} requires ${required}, but that capability is unknown.`
      );
    }
    const requiredStatus = inspectCapabilityStatus({
      repoRoot,
      atlasVersion,
      capability: requiredDefinition,
      assetRoot: options.assetRoot,
    });
    if (requiredStatus !== "installed") {
      throw new CliError(
        CliErrorCode.USAGE_ERROR,
        `${definition.id} requires ${required} to be fully installed (status: ${requiredStatus}). Enable ${required} first and resolve conflicts.`
      );
    }
  }

  const planned = planCapability({
    repoRoot,
    atlasVersion,
    definition,
    assetRoot: options.assetRoot,
  });
  const actions = applyDeferredWrites(planned, dryRun);

  if (definition.id === "docs" && actions.every((action) => action.kind === "skip")) {
    warnings.push({
      code: "ALREADY_ENABLED",
      message: "Consumer documentation is already current.",
    });
  }

  if (definition.id === "storybook" || definition.id === "visual" || definition.id === "hooks") {
    warnings.push({
      code: "INSTALL_REQUIRED",
      message: "Run pnpm install after this enablement so new dependencies are present.",
    });
  }

  if (definition.id === "storybook") {
    warnings.push({
      code: "PLAYWRIGHT_BROWSERS",
      message:
        "Install Playwright browsers in packages/ui before running Storybook interaction or accessibility tests.",
    });
  }

  if (definition.id === "visual") {
    warnings.push({
      code: "VISUAL_DOCKER",
      message:
        "Compare shipped baselines with `pnpm --filter @atlas/ui test:visual:docker` (Playwright noble image). Do not run host Chromium against packaged PNGs and do not use --update-snapshots to silence failures. Recapture only via that image after reviewing every PNG.",
    });
  }

  if (definition.id === "docker") {
    warnings.push({
      code: "LOCKFILE_REQUIRED",
      message:
        "The Dockerfile uses pnpm install --frozen-lockfile. Commit pnpm-lock.yaml before building the image, and change image labels to your repository.",
    });
  }

  warnings.push({
    code: "STATUS_NOT_OPERATIONAL",
    message: CAPABILITY_STATUS_MEANING,
  });

  return {
    repoRoot,
    atlasVersion,
    capability: definition.id as CapabilityId,
    actions,
    warnings,
  };
}
