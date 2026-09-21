export function overridePackageName(key: string): string {
  if (key.startsWith("@")) {
    return key;
  }
  const versionSeparator = key.lastIndexOf("@");
  if (versionSeparator > 0) {
    return key.slice(0, versionSeparator);
  }
  return key;
}

export function collectDependencyNames(
  manifests: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  }[]
): Set<string> {
  const names = new Set<string>();
  for (const manifest of manifests) {
    for (const section of [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
    ]) {
      for (const name of Object.keys(section ?? {})) {
        names.add(name);
      }
    }
  }
  return names;
}

/**
 * Keep only Atlas pnpm.overrides whose package appears as a direct dependency of the consumer
 * workspace. Transitive-only pins stay maintainer-side unless the consumer actually depends on
 * that package (for example \`vite\` after Storybook is enabled).
 */
export function selectConsumerPnpmOverrides(
  atlasOverrides: Record<string, string>,
  dependencyNames: Iterable<string>
): Record<string, string> {
  const names = new Set(dependencyNames);
  const selected: Record<string, string> = {};
  for (const [key, value] of Object.entries(atlasOverrides)) {
    if (names.has(overridePackageName(key))) {
      selected[key] = value;
    }
  }
  return selected;
}
