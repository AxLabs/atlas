import { BootstrapAssetError } from "./errors";

/** Destination of the derived consumer UI package manifest. */
export const CONSUMER_UI_PACKAGE_JSON_DESTINATION = "packages/ui/package.json";

/**
 * Storybook packages that packaged UI source still imports (`*.stories.tsx`,
 * `LoginForm.example.tsx`, and the a11y runtime-policy unit test). These stay
 * so consumer typecheck/test keep working without shipping `.storybook/**`.
 */
const RETAINED_STORYBOOK_DEV_DEPENDENCIES = new Set(["@storybook/react", "@storybook/test"]);

const OMITTED_UI_SCRIPT_NAMES = new Set([
  "storybook",
  "build-storybook",
  "test:storybook",
  "test:storybook:cross-browser",
  "test:visual",
  "test:visual:update",
  "test:visual:docker",
  "test:ui-quality",
]);

const OMITTED_SCRIPT_TOOLING_PATTERNS = [
  /(?:^|[^A-Za-z0-9_-])husky(?:$|[^A-Za-z0-9_-])/,
  /playwright\.storybook\.config\.ts/,
  /playwright\.visual\.config\.ts/,
  /(?:^|[\s"'=])\.storybook(?:\/|[\s"']|$)/,
  /visual-tests/,
  /(?:^|[\s"'=])storybook(?:$|[\s"'])/,
  /build-storybook/,
  /test:storybook/,
  /test:visual/,
  /scripts\/[\w.-]*storybook/,
] as const;

function asJsonObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BootstrapAssetError(`${label} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}

function asStringRecord(value: unknown, label: string): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = asJsonObject(value, label);
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== "string") {
      throw new BootstrapAssetError(`${label}.${key} must be a string.`);
    }
    result[key] = entry;
  }
  return result;
}

export function scriptReferencesOmittedUiTooling(script: string): boolean {
  return OMITTED_SCRIPT_TOOLING_PATTERNS.some((pattern) => pattern.test(script));
}

export function shouldOmitConsumerUiScript(name: string, value: string): boolean {
  return OMITTED_UI_SCRIPT_NAMES.has(name) || scriptReferencesOmittedUiTooling(value);
}

export function shouldOmitConsumerUiDevDependency(name: string): boolean {
  if (
    name === "husky" ||
    name === "storybook" ||
    name === "@playwright/test" ||
    name === "axe-playwright" ||
    name === "vite" ||
    name === "@tailwindcss/vite"
  ) {
    return true;
  }

  return name.startsWith("@storybook/") && !RETAINED_STORYBOOK_DEV_DEPENDENCIES.has(name);
}

function omitRecord(
  record: Record<string, string> | undefined,
  shouldOmit: (name: string, value: string) => boolean
): Record<string, string> | undefined {
  if (record === undefined) {
    return undefined;
  }

  const next: Record<string, string> = {};
  for (const [name, value] of Object.entries(record)) {
    if (!shouldOmit(name, value)) {
      next[name] = value;
    }
  }
  return next;
}

/**
 * Derive the consumer UI package manifest from the maintainer `packages/ui`
 * package.json. Canonical source stays untouched; only the packaged copy is
 * rewritten so scripts/devDependencies match the trimmed starter tree.
 */
export function toConsumerUiPackageManifest(raw: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new BootstrapAssetError(
      `Unable to parse ${CONSUMER_UI_PACKAGE_JSON_DESTINATION} for the consumer bootstrap copy: ${message}`
    );
  }

  const manifest = asJsonObject(parsed, CONSUMER_UI_PACKAGE_JSON_DESTINATION);
  const scripts = omitRecord(
    asStringRecord(manifest.scripts, "scripts"),
    shouldOmitConsumerUiScript
  );
  const devDependencies = omitRecord(
    asStringRecord(manifest.devDependencies, "devDependencies"),
    (name) => shouldOmitConsumerUiDevDependency(name)
  );

  if (scripts === undefined || Object.keys(scripts).length === 0) {
    delete manifest.scripts;
  } else {
    manifest.scripts = scripts;
  }

  if (devDependencies === undefined || Object.keys(devDependencies).length === 0) {
    delete manifest.devDependencies;
  } else {
    manifest.devDependencies = devDependencies;
  }

  return `${JSON.stringify(manifest, null, 2)}\n`;
}
