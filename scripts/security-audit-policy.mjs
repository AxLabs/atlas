import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = path.resolve(scriptDir, "..");

export const SEVERITY_RANK = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ADVISORY_ID_PATTERN = /^(GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}|CVE-\d{4}-\d{4,})$/i;
const WILDCARD_PATTERN = /[*?]|^\s*$/;

export function isValidIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function compareIsoDate(left, right) {
  return left.localeCompare(right);
}

export function normalizeSeverity(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return Object.hasOwn(SEVERITY_RANK, normalized) ? normalized : null;
}

export function loadJsonFile(filePath, label) {
  if (!existsSync(filePath)) {
    throw operationalError(`${label} is missing: ${filePath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw operationalError(`${label} is not valid JSON: ${error.message}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw operationalError(`${label} must be a JSON object`);
  }

  return parsed;
}

export function loadPolicy(root = DEFAULT_REPO_ROOT) {
  const filePath = path.join(root, "security", "policy.json");
  const raw = loadJsonFile(filePath, "security policy");
  const severity = normalizeSeverity(raw.minimumBlockingSeverity);
  if (!severity) {
    throw operationalError("security policy minimumBlockingSeverity is missing or unknown");
  }

  const staleExceptions = raw.staleExceptions === "ignore" ? "ignore" : "fail";
  const gitleaks = raw.gitleaks;
  if (!gitleaks || typeof gitleaks !== "object") {
    throw operationalError("security policy gitleaks pin is missing");
  }

  if (
    typeof gitleaks.image !== "string" ||
    typeof gitleaks.version !== "string" ||
    typeof gitleaks.digest !== "string" ||
    !gitleaks.digest.startsWith("sha256:")
  ) {
    throw operationalError("security policy gitleaks pin is incomplete");
  }

  return {
    schemaVersion: raw.schemaVersion ?? 1,
    minimumBlockingSeverity: severity,
    staleExceptions,
    gitleaks: {
      image: gitleaks.image,
      version: gitleaks.version,
      digest: gitleaks.digest,
    },
  };
}

export function loadExceptions(root = DEFAULT_REPO_ROOT) {
  const filePath = path.join(root, "security-audit-exceptions.json");
  const raw = loadJsonFile(filePath, "security audit exceptions");
  if (!Array.isArray(raw.exceptions)) {
    throw operationalError("security-audit-exceptions.json must contain an exceptions array");
  }
  return raw.exceptions;
}

export function operationalError(message) {
  const error = new Error(message);
  error.code = "ATLAS_SECURITY_OPERATIONAL";
  return error;
}

export function isOperationalError(error) {
  return Boolean(error && error.code === "ATLAS_SECURITY_OPERATIONAL");
}

export function assertAuditDocument(audit) {
  if (audit === null || typeof audit !== "object" || Array.isArray(audit)) {
    throw operationalError("audit document is missing or not an object");
  }

  const hasV2 = audit.vulnerabilities !== undefined;
  const hasV1 = audit.advisories !== undefined;
  const hasMetadata = audit.metadata !== undefined;

  if (!hasV2 && !hasV1 && !hasMetadata) {
    throw operationalError("audit document is missing vulnerabilities, advisories, and metadata");
  }

  if (hasV2 && (audit.vulnerabilities === null || typeof audit.vulnerabilities !== "object")) {
    throw operationalError("audit document vulnerabilities must be an object");
  }

  if (hasV1 && (audit.advisories === null || typeof audit.advisories !== "object")) {
    throw operationalError("audit document advisories must be an object");
  }

  return audit;
}

function advisoryIdFromUrl(url) {
  if (typeof url !== "string") {
    return null;
  }
  const ghsa = url.match(/GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i);
  if (ghsa) {
    return normalizeAdvisoryId(ghsa[0]);
  }
  const cve = url.match(/CVE-\d{4}-\d{4,}/i);
  return cve ? normalizeAdvisoryId(cve[0]) : null;
}

function normalizeAdvisoryId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!ADVISORY_ID_PATTERN.test(trimmed)) {
    return null;
  }
  if (trimmed.toUpperCase().startsWith("CVE-")) {
    return trimmed.toUpperCase();
  }
  const parts = trimmed.split("-");
  return `GHSA-${parts[1].toLowerCase()}-${parts[2].toLowerCase()}-${parts[3].toLowerCase()}`;
}

function collectFromVia(packageName, via, parentSeverity) {
  if (typeof via === "string") {
    return [];
  }
  if (!via || typeof via !== "object") {
    return [];
  }

  const advisoryId =
    normalizeAdvisoryId(via.id) ||
    normalizeAdvisoryId(via.github_advisory_id) ||
    advisoryIdFromUrl(via.url) ||
    (typeof via.source === "string" ? normalizeAdvisoryId(via.source) : null);

  const severity = normalizeSeverity(via.severity) || normalizeSeverity(parentSeverity) || "low";
  const name = typeof via.name === "string" ? via.name : packageName;

  return [
    {
      packageName: name,
      severity,
      advisoryId: advisoryId ? advisoryId : `UNRESOLVED:${name}:${via.source ?? via.title ?? "unknown"}`,
      title: typeof via.title === "string" ? via.title : "Untitled advisory",
      url: typeof via.url === "string" ? via.url : null,
      range: typeof via.range === "string" ? via.range : null,
      patchedVersions:
        via.fixAvailable && typeof via.fixAvailable === "object" && via.fixAvailable.version
          ? via.fixAvailable.version
          : null,
    },
  ];
}

export function collectFindings(audit) {
  const document = assertAuditDocument(audit);
  const findings = [];
  const seen = new Set();

  function addFinding(finding) {
    const key = `${finding.advisoryId}::${finding.packageName}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    findings.push(finding);
  }

  if (document.vulnerabilities && typeof document.vulnerabilities === "object") {
    for (const [packageName, entry] of Object.entries(document.vulnerabilities)) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const viaList = Array.isArray(entry.via) ? entry.via : [];
      const parentSeverity = entry.severity;
      const patched =
        entry.fixAvailable && typeof entry.fixAvailable === "object" && entry.fixAvailable.version
          ? entry.fixAvailable.version
          : typeof entry.fixAvailable === "boolean"
            ? null
            : null;

      if (viaList.length === 0) {
        const severity = normalizeSeverity(parentSeverity) || "low";
        addFinding({
          packageName: entry.name || packageName,
          severity,
          advisoryId: `UNRESOLVED:${packageName}`,
          title: "Unresolved vulnerability entry",
          url: null,
          range: typeof entry.range === "string" ? entry.range : null,
          patchedVersions: patched,
        });
        continue;
      }

      for (const via of viaList) {
        for (const finding of collectFromVia(entry.name || packageName, via, parentSeverity)) {
          if (!finding.patchedVersions && patched) {
            finding.patchedVersions = patched;
          }
          if (!finding.range && typeof entry.range === "string") {
            finding.range = entry.range;
          }
          addFinding(finding);
        }
      }
    }
  }

  if (document.advisories && typeof document.advisories === "object") {
    for (const advisory of Object.values(document.advisories)) {
      if (!advisory || typeof advisory !== "object") {
        continue;
      }
      const moduleName = advisory.module_name || advisory.name;
      const advisoryId =
        normalizeAdvisoryId(advisory.github_advisory_id) ||
        normalizeAdvisoryId(advisory.cves?.[0]) ||
        advisoryIdFromUrl(advisory.url) ||
        `UNRESOLVED:${moduleName ?? "unknown"}`;
      addFinding({
        packageName: moduleName || "unknown",
        severity: normalizeSeverity(advisory.severity) || "low",
        advisoryId,
        title: advisory.title || "Untitled advisory",
        url: advisory.url || null,
        range: advisory.vulnerable_versions || null,
        patchedVersions: advisory.patched_versions || null,
      });
    }
  }

  return findings.sort((left, right) => {
    const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return `${left.packageName}:${left.advisoryId}`.localeCompare(
      `${right.packageName}:${right.advisoryId}`,
    );
  });
}

export function validateExceptionEntry(entry, index) {
  const label = `exceptions[${index}]`;
  const errors = [];

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return [`${label}: exception must be an object`];
  }

  const requiredStrings = ["owner", "reason", "compensatingControl", "reviewedOn", "expiresOn"];
  for (const field of requiredStrings) {
    if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
      errors.push(`${label}: ${field} must be a non-empty string`);
    }
  }

  if (!isValidIsoDate(entry.reviewedOn)) {
    errors.push(`${label}: reviewedOn must be a valid YYYY-MM-DD date`);
  }
  if (!isValidIsoDate(entry.expiresOn)) {
    errors.push(`${label}: expiresOn must be a valid YYYY-MM-DD date`);
  }

  const advisoryId = normalizeAdvisoryId(entry.advisory);
  if (!advisoryId) {
    errors.push(`${label}: advisory must be a GHSA-xxxx-xxxx-xxxx or CVE-YYYY-NNNN identifier`);
  } else if (WILDCARD_PATTERN.test(entry.advisory)) {
    errors.push(`${label}: advisory must not be a wildcard`);
  }

  if (typeof entry.packageName !== "string" || entry.packageName.trim().length === 0) {
    errors.push(`${label}: packageName must be a non-empty string`);
  } else if (WILDCARD_PATTERN.test(entry.packageName) || entry.packageName === "*") {
    errors.push(`${label}: packageName must not be a wildcard`);
  }

  if (entry.packageName === undefined && entry.package !== undefined) {
    errors.push(`${label}: unknown field "package"; use packageName`);
  }

  return { errors, advisoryId, packageName: entry.packageName?.trim() };
}

export function evaluateSecurityAudit({
  audit,
  exceptions,
  policy,
  now = todayUtc(),
} = {}) {
  const findings = collectFindings(audit);
  const exceptionErrors = [];
  const expired = [];
  const excepted = [];
  const stale = [];
  const usedExceptionIndexes = new Set();

  if (!Array.isArray(exceptions)) {
    throw operationalError("exceptions must be an array");
  }

  const normalizedExceptions = exceptions.map((entry, index) => {
    const validated = validateExceptionEntry(entry, index);
    if (validated.errors.length > 0) {
      exceptionErrors.push(...validated.errors);
      return null;
    }

    const expiredAlready = compareIsoDate(entry.expiresOn, now) < 0;
    return {
      index,
      advisoryId: validated.advisoryId,
      packageName: validated.packageName,
      expiresOn: entry.expiresOn,
      expired: expiredAlready,
      owner: entry.owner,
      reason: entry.reason,
      compensatingControl: entry.compensatingControl,
    };
  });

  if (exceptionErrors.length > 0) {
    return {
      ok: false,
      failClosed: true,
      reason: "malformed-exceptions",
      findings,
      blocking: [],
      excepted,
      expired,
      stale,
      exceptionErrors,
      counts: countFindings(findings),
    };
  }

  const blocking = [];

  for (const finding of findings) {
    const match = normalizedExceptions.find(
      (exception) =>
        exception &&
        exception.advisoryId === finding.advisoryId &&
        exception.packageName === finding.packageName,
    );

    if (match) {
      usedExceptionIndexes.add(match.index);
      if (match.expired) {
        expired.push({ finding, exception: match });
        if (isBlockingSeverity(finding.severity, policy.minimumBlockingSeverity)) {
          blocking.push(finding);
        }
      } else {
        excepted.push({ finding, exception: match });
      }
      continue;
    }

    if (isBlockingSeverity(finding.severity, policy.minimumBlockingSeverity)) {
      blocking.push(finding);
    }
  }

  for (const exception of normalizedExceptions) {
    if (!exception || usedExceptionIndexes.has(exception.index)) {
      continue;
    }
    stale.push(exception);
  }

  const staleFails = policy.staleExceptions !== "ignore" && stale.length > 0;
  const expiredBlocks = expired.length > 0 && expired.some(({ finding }) =>
    isBlockingSeverity(finding.severity, policy.minimumBlockingSeverity),
  );

  return {
    ok: blocking.length === 0 && exceptionErrors.length === 0 && !staleFails,
    failClosed: false,
    reason: blocking.length > 0 ? "blocking-vulnerabilities" : staleFails ? "stale-exceptions" : "pass",
    findings,
    blocking,
    excepted,
    expired,
    stale,
    exceptionErrors,
    counts: countFindings(findings),
    expiredBlocks,
  };
}

export function isBlockingSeverity(severity, minimumBlockingSeverity) {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[minimumBlockingSeverity];
}

export function countFindings(findings) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }
  return counts;
}

export function todayUtc(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function formatSecuritySummary(evaluation, policy) {
  const lines = [];
  lines.push("Atlas dependency security audit");
  lines.push("");
  lines.push(`critical: ${evaluation.counts.critical}`);
  lines.push(`high: ${evaluation.counts.high}`);
  lines.push(`moderate: ${evaluation.counts.moderate}`);
  lines.push(`low: ${evaluation.counts.low}`);
  lines.push("");
  lines.push(`blocking: ${evaluation.blocking.length}`);
  lines.push(`excepted: ${evaluation.excepted.length}`);
  lines.push(`expired exceptions: ${evaluation.expired.length}`);
  lines.push(`stale exceptions: ${evaluation.stale.length}`);
  lines.push(`policy: fail on ${policy.minimumBlockingSeverity.toUpperCase()} and above`);
  lines.push("");

  if (evaluation.exceptionErrors.length > 0) {
    lines.push("Malformed exceptions");
    for (const error of evaluation.exceptionErrors) {
      lines.push(`  ${error}`);
    }
    lines.push("");
    lines.push("✗ Dependency vulnerability policy failed");
    return lines.join("\n");
  }

  if (evaluation.findings.length > 0 && evaluation.blocking.length === 0) {
    const visible = evaluation.findings.filter(
      (finding) => !isBlockingSeverity(finding.severity, policy.minimumBlockingSeverity),
    );
    if (visible.length > 0) {
      lines.push("Non-blocking findings");
      for (const finding of visible) {
        lines.push(`${finding.packageName}`);
        lines.push(`  advisory: ${finding.advisoryId}`);
        lines.push(`  severity: ${finding.severity}`);
      }
      lines.push("");
    }
  }

  if (evaluation.stale.length > 0) {
    lines.push("Stale exceptions");
    for (const exception of evaluation.stale) {
      lines.push(
        `  ${exception.advisoryId} (${exception.packageName}) is not present in the current audit`,
      );
    }
    lines.push("");
  }

  if (evaluation.expired.length > 0) {
    lines.push("Expired exceptions");
    for (const { finding, exception } of evaluation.expired) {
      lines.push(`  ${finding.advisoryId} (${finding.packageName}) expired ${exception.expiresOn}`);
    }
    lines.push("");
  }

  if (evaluation.blocking.length > 0) {
    lines.push("Blocking vulnerabilities");
    for (const finding of evaluation.blocking) {
      lines.push(`${finding.packageName}`);
      lines.push(`  advisory: ${finding.advisoryId}`);
      lines.push(`  severity: ${finding.severity}`);
      if (finding.range) {
        lines.push(`  vulnerable range: ${finding.range}`);
      }
      if (finding.patchedVersions) {
        lines.push(`  patched versions: ${finding.patchedVersions}`);
      }
    }
    lines.push("");
    lines.push("✗ Dependency vulnerability policy failed");
    return lines.join("\n");
  }

  if (!evaluation.ok) {
    lines.push("✗ Dependency vulnerability policy failed");
    return lines.join("\n");
  }

  lines.push("✓ Dependency vulnerability policy passed");
  return lines.join("\n");
}
