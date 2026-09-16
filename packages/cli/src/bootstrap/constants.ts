export const BOOTSTRAP_MANIFEST_SCHEMA_VERSION = 1;

/** Canonical source allowlist, relative to the `@blitzcraftlabs/atlas` package root. */
export const SOURCE_BOOTSTRAP_MANIFEST_RELATIVE_PATH = "bootstrap/manifest.json";

/** Packaged asset root, relative to the installed `@blitzcraftlabs/atlas` package root. */
export const PACKAGED_BOOTSTRAP_ASSET_ROOT_SEGMENTS = ["assets", "bootstrap"] as const;

export const PACKAGED_BOOTSTRAP_MANIFEST_NAME = "manifest.json";
export const PACKAGED_BOOTSTRAP_FILES_DIR = "files";

export const CHECKSUM_PREFIX = "sha256:";
export const CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/;
export const POSIX_MODE_PATTERN = /^0[0-7]{3}$/;

/** Directory names skipped while expanding allowlisted trees. */
export const SKIP_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "coverage",
  ".turbo",
  "storybook-static",
  "playwright-report",
  "test-results",
]);

/**
 * Artifact globs always excluded from allowlisted directories. These are not a
 * repository-wide blacklist: they only apply inside explicit manifest entries.
 */
export const ARTIFACT_EXCLUDE_GLOBS = [
  "node_modules/**",
  ".git/**",
  ".next/**",
  "dist/**",
  "coverage/**",
  ".turbo/**",
  "storybook-static/**",
  "playwright-report/**",
  "playwright-report-*/**",
  "test-results/**",
  "**/*.tsbuildinfo",
  "**/.DS_Store",
  "**/next-env.d.ts",
  "**/.env",
  "**/.env.local",
  "**/.env.*.local",
  "**/.gen-validation-*.json",
  "**/__gen-validation-*/**",
  "**/*.pem",
] as const;
