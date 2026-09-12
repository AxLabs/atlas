/**
 * Parse Changesets workspace changelog sections into structured entries and
 * render a Keep a Changelog style Atlas platform release body.
 */

export const PLATFORM_CATEGORY_ORDER = Object.freeze([
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security",
  "Breaking Changes",
]);

const CHANGESET_HEADINGS = new Set(["major changes", "minor changes", "patch changes"]);

const PACKAGE_BUMP_PATTERN = /^@[\w.-]+\/[\w.-]+@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "atlas",
  "at",
  "be",
  "by",
  "can",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "onto",
  "or",
  "so",
  "than",
  "that",
  "the",
  "then",
  "this",
  "to",
  "via",
  "was",
  "were",
  "with",
]);

const LEADING_VERBS = new Set([
  "add",
  "added",
  "align",
  "aligned",
  "establish",
  "fix",
  "fixed",
  "improve",
  "improved",
  "introduce",
  "make",
  "repair",
  "update",
  "updated",
]);

const BULLET_WIDTH = 100;

export function stripChangesetPrefix(text) {
  return text.replace(/^[0-9a-f]{7,40}:\s+/i, "");
}

export function platformBulletText(text) {
  const stripped = stripChangesetPrefix(String(text ?? "").trim());
  const lines = stripped.split("\n");
  const kept = [];

  for (const line of lines) {
    if (/^\s*[-*]\s+/.test(line)) {
      break;
    }
    kept.push(line.trimEnd());
  }

  while (kept.length > 0 && kept[kept.length - 1].trim() === "") {
    kept.pop();
  }

  return kept.join("\n").trim();
}

export function wrapMarkdownBullet(prose, width = BULLET_WIDTH) {
  const normalized = platformBulletText(prose).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const hanging = "  ";
  const words = normalized.split(" ");
  const lines = [];
  let current = "-";

  for (const word of words) {
    const candidate = `${current} ${word}`;
    if (candidate.length > width && current.length > 1) {
      lines.push(current);
      current = `${hanging}${word}`;
    } else {
      current = candidate;
    }
  }

  lines.push(current);
  return lines.join("\n");
}

function canonicalCategory(heading) {
  if (!heading) {
    return null;
  }

  if (CHANGESET_HEADINGS.has(heading.toLowerCase())) {
    return null;
  }

  return PLATFORM_CATEGORY_ORDER.find((category) => category.toLowerCase() === heading.toLowerCase()) ?? null;
}

export function isPackageBumpNoise(text) {
  const prose = platformBulletText(text);
  if (!prose) {
    return true;
  }

  const summary = prose.replace(/\s+/g, " ").trim();
  if (/^updated dependencies\b/i.test(summary)) {
    return true;
  }

  const contentLines = String(text)
    .split("\n")
    .map((line) => stripChangesetPrefix(line.trim().replace(/^[-*]\s+/, "")))
    .filter(Boolean);

  if (contentLines.length === 0) {
    return true;
  }

  return contentLines.every((line) => PACKAGE_BUMP_PATTERN.test(line));
}

export function categorizeEntry(entry) {
  const fromHeading = canonicalCategory(entry.heading ?? "");
  if (fromHeading) {
    return fromHeading;
  }

  const summary = platformBulletText(entry.text).replace(/\s+/g, " ").trim().toLowerCase();

  if (/\b(security|threat model|spdx|gitleaks|high\/critical)\b/.test(summary)) {
    return "Security";
  }

  if (
    /^(repair|fix|fixed|fixes)\b/.test(summary) ||
    /\b(repair(?:s|ed)?|hotfix|regression)\b/.test(summary)
  ) {
    return "Fixed";
  }

  if (
    /\b(establish|introduce|added\b|public documentation|contribution model|release governance|apache-2\.0)\b/.test(
      summary,
    )
  ) {
    return "Added";
  }

  return "Changed";
}

function significantTokens(text) {
  return platformBulletText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word) && !LEADING_VERBS.has(word) && !/^\d+$/.test(word));
}

const DUPLICATE_THEMES = [
  [/release governance/, "release-governance"],
  [/public documentation/, "public-oss"],
  [/security checks|threat model/, "security-hardening"],
  [/search input styling|theme boot/, "ui-theme"],
  [/release automation|version prs validate/, "release-automation"],
];

function duplicateTheme(text) {
  const normalized = platformBulletText(text).toLowerCase();
  for (const [pattern, theme] of DUPLICATE_THEMES) {
    if (pattern.test(normalized)) {
      return theme;
    }
  }
  return null;
}

export function entriesAreNearDuplicates(left, right) {
  const leftTheme = duplicateTheme(left.text);
  const rightTheme = duplicateTheme(right.text);
  if (leftTheme && rightTheme) {
    return leftTheme === rightTheme;
  }

  const leftKey = significantTokens(left.text).join(" ");
  const rightKey = significantTokens(right.text).join(" ");
  if (!leftKey || !rightKey) {
    return false;
  }
  if (leftKey === rightKey) {
    return true;
  }

  const shorter = leftKey.length <= rightKey.length ? leftKey : rightKey;
  const longer = leftKey.length <= rightKey.length ? rightKey : leftKey;
  return shorter.length >= 40 && longer.includes(shorter);
}

export function parseChangelogEntries(body, meta = {}) {
  const source = meta.source ?? "workspace";
  const packageName = meta.packageName ?? null;
  const entries = [];
  const lines = String(body ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  let heading = "";
  let current = null;

  const flush = () => {
    if (!current) {
      return;
    }

    const text = current.lines.join("\n").trim();
    if (text) {
      entries.push({
        source,
        packageName,
        heading: current.heading,
        text,
      });
    }

    current = null;
  };

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+?)\s*$/);
    if (headingMatch) {
      flush();
      heading = headingMatch[1].trim();
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+([\s\S]*)$/);
    if (bulletMatch) {
      flush();
      current = { heading, lines: [bulletMatch[1]] };
      continue;
    }

    if (current && (line.trim() === "" || /^\s+/.test(line))) {
      current.lines.push(line);
      continue;
    }
  }

  flush();
  return entries;
}

export function mergePlatformEntries({ existing = [], unreleased = [], workspace = [] } = {}) {
  const kept = [];

  for (const entry of [...existing, ...unreleased, ...workspace]) {
    if (isPackageBumpNoise(entry.text)) {
      continue;
    }

    const merged = {
      ...entry,
      category: categorizeEntry(entry),
      text: platformBulletText(entry.text),
    };

    if (!merged.text) {
      continue;
    }

    if (kept.some((item) => entriesAreNearDuplicates(item, merged))) {
      continue;
    }

    kept.push(merged);
  }

  return kept;
}

export function renderPlatformReleaseBody(entries) {
  const grouped = new Map(PLATFORM_CATEGORY_ORDER.map((category) => [category, []]));

  for (const entry of entries) {
    const category = PLATFORM_CATEGORY_ORDER.includes(entry.category) ? entry.category : "Changed";
    grouped.get(category).push(entry);
  }

  const parts = [];
  for (const category of PLATFORM_CATEGORY_ORDER) {
    const list = grouped.get(category) ?? [];
    if (list.length === 0) {
      continue;
    }

    parts.push(`### ${category}`, "");
    for (const entry of list) {
      parts.push(wrapMarkdownBullet(entry.text));
    }
    parts.push("");
  }

  return parts.join("\n").trim();
}

export function buildPlatformReleaseBody({ existingBody = "", unreleasedBody = "", workspaceBodies = [] } = {}) {
  const existing = parseChangelogEntries(existingBody, { source: "existing" });
  const unreleased = parseChangelogEntries(unreleasedBody, { source: "unreleased" });
  const workspace = workspaceBodies.flatMap((item) =>
    parseChangelogEntries(item.body, { source: "workspace", packageName: item.packageName ?? null }),
  );

  return renderPlatformReleaseBody(mergePlatformEntries({ existing, unreleased, workspace }));
}
