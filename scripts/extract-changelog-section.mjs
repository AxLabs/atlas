/**
 * Extract changelog sections for Atlas root CHANGELOG.md.
 */

export function extractChangelogSection(changelog, version) {
  const escaped = version.replace(/\./g, "\\.");
  const headerPattern = new RegExp(
    `^##\\s+(?:\\[${escaped}\\]|${escaped})(?:\\s+-\\s+.+)?\\s*$`,
    "m",
  );
  const match = changelog.match(headerPattern);

  if (!match) {
    return null;
  }

  const start = match.index;
  const afterHeader = changelog.slice(start + match[0].length);
  const nextHeader = afterHeader.search(/^##\s+/m);
  let body = nextHeader === -1 ? afterHeader : afterHeader.slice(0, nextHeader);

  const linkRefIndex = body.search(/^\[[^\]]+\]:\s/m);
  if (linkRefIndex !== -1) {
    body = body.slice(0, linkRefIndex);
  }

  return `${match[0].trim()}\n${body.trim()}`.trim();
}

/** Section body without the ## header line. */
export function extractSectionBody(section) {
  const lines = section.split("\n");
  if (lines.length === 0) {
    return "";
  }

  if (lines[0].startsWith("## ")) {
    return lines.slice(1).join("\n").trim();
  }

  return section.trim();
}

export function extractSectionDate(section) {
  const firstLine = section.split("\n")[0] ?? "";
  const match = firstLine.match(/^##\s+\[[^\]]+\]\s*-\s+(.+)$/);
  return match?.[1]?.trim() ?? null;
}

export function buildReleaseNotesPreview(changelog, version, options = {}) {
  const section = extractChangelogSection(changelog, version);

  if (!section) {
    throw new Error(
      `No changelog section found for Atlas version ${version} in CHANGELOG.md`,
    );
  }

  const footer = [
    "---",
    `**Atlas ${version}** — repository/platform snapshot. See [Releases and Governance](docs/how-we-build/releases-and-governance.md).`,
    options.ciRunUrl ? `**CI run:** ${options.ciRunUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `${section}\n\n${footer}`;
}
