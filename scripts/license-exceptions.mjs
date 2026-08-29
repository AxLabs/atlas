import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { classifyLicenseExpression } from "./license-policy.mjs";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export function requiresEffectiveLicenseEvidence(license) {
  if (license == null) {
    return true;
  }

  const normalized = String(license).trim();
  if (!normalized) {
    return true;
  }

  if (/^SEE LICENSE/i.test(normalized)) {
    return true;
  }

  return classifyLicenseExpression(normalized) === "unknown";
}

export function validateExceptionEntry(key, entry, { package: pkg } = {}) {
  const errors = [];

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push(`${key}: exception must be an object`);
    return errors;
  }

  if (entry.status !== "reviewed") {
    errors.push(`${key}: status must be "reviewed" (found: ${JSON.stringify(entry.status)})`);
  }

  if (typeof entry.reason !== "string" || entry.reason.trim().length === 0) {
    errors.push(`${key}: reason must be a non-empty string`);
  }

  if (!isValidIsoDate(entry.reviewedOn)) {
    errors.push(`${key}: reviewedOn must be a valid YYYY-MM-DD date`);
  }

  const declaredLicense = pkg?.license ?? null;
  const declaredStatus = classifyLicenseExpression(declaredLicense);

  if (pkg && requiresEffectiveLicenseEvidence(declaredLicense)) {
    if (typeof entry.effectiveLicense !== "string" || entry.effectiveLicense.trim().length === 0) {
      errors.push(
        `${key}: effectiveLicense is required when manifest license is missing or nonstandard`,
      );
    }

    if (typeof entry.source !== "string" || entry.source.trim().length === 0) {
      errors.push(
        `${key}: source is required when manifest license is missing or nonstandard`,
      );
    }
  }

  if (
    typeof entry.effectiveLicense === "string" &&
    entry.effectiveLicense.trim().length > 0 &&
    classifyLicenseExpression(entry.effectiveLicense) === "unknown"
  ) {
    errors.push(`${key}: effectiveLicense is unknown to Atlas policy`);
  }

  if (declaredStatus === "disallowed") {
    errors.push(`${key}: disallowed licenses cannot be overridden by an exception`);
  }

  if (
    typeof entry.effectiveLicense === "string" &&
    classifyLicenseExpression(entry.effectiveLicense) === "disallowed"
  ) {
    errors.push(`${key}: effectiveLicense is disallowed by Atlas policy`);
  }

  if (declaredStatus === "review-required" || declaredStatus === "unknown") {
    if (entry.disposition !== "accepted") {
      errors.push(`${key}: disposition must be "accepted" to acknowledge a reviewed license`);
    }
  }

  return errors;
}

export function validateExceptionEvidenceSource(key, entry, { package: pkg, repoRoot } = {}) {
  const errors = [];
  const declaredLicense = pkg?.license ?? null;

  if (!repoRoot || !requiresEffectiveLicenseEvidence(declaredLicense)) {
    return errors;
  }

  const source = entry?.source;
  if (typeof source !== "string" || source.trim().length === 0) {
    return errors;
  }

  const trimmed = source.trim();
  if (path.isAbsolute(trimmed)) {
    errors.push(`${key}: source must be relative to the repository root`);
    return errors;
  }

  const resolved = path.resolve(repoRoot, trimmed);
  const relativeToRepo = path.relative(repoRoot, resolved);
  if (relativeToRepo.startsWith("..") || path.isAbsolute(relativeToRepo)) {
    errors.push(`${key}: source escapes the repository root (${trimmed})`);
    return errors;
  }

  let stats;
  try {
    stats = statSync(resolved);
  } catch {
    errors.push(`${key}: evidence source does not exist (${trimmed})`);
    return errors;
  }

  if (!stats.isFile()) {
    errors.push(`${key}: evidence source is not a readable file (${trimmed})`);
    return errors;
  }

  try {
    readFileSync(resolved);
  } catch {
    errors.push(`${key}: evidence source is not readable (${trimmed})`);
    return errors;
  }

  if (pkg) {
    const normalizedSource = trimmed.replace(/\\/g, "/");
    const expectedPrefix = `node_modules/${pkg.name}/`;
    if (!normalizedSource.startsWith(expectedPrefix)) {
      errors.push(
        `${key}: evidence source must reference installed package material under ${expectedPrefix}`,
      );
      return errors;
    }

    const pkgDir = path.resolve(pkg.path ?? path.join(repoRoot, "node_modules", pkg.name));
    const relativeToPackage = path.relative(pkgDir, resolved);
    if (relativeToPackage.startsWith("..") || path.isAbsolute(relativeToPackage)) {
      errors.push(
        `${key}: evidence source does not resolve inside installed package directory for ${pkg.name}`,
      );
    }
  }

  return errors;
}

export function validatePackageException(key, entry, pkg, repoRoot) {
  return [
    ...validateExceptionEntry(key, entry, { package: pkg }),
    ...validateExceptionEvidenceSource(key, entry, { package: pkg, repoRoot }),
  ];
}

export function buildExceptionErrorsByKey(exceptions, packagesByKey, { repoRoot } = {}) {
  const errorsByKey = new Map();

  for (const [key, entry] of Object.entries(exceptions)) {
    const pkg = packagesByKey.get(key);
    const errors = validatePackageException(key, entry, pkg, repoRoot);
    if (errors.length > 0) {
      errorsByKey.set(key, errors);
    }
  }

  return errorsByKey;
}

export function validateExceptions(exceptions, packagesByKey, { repoRoot } = {}) {
  const errors = [];

  for (const [key, entry] of Object.entries(exceptions)) {
    const pkg = packagesByKey.get(key);
    errors.push(...validatePackageException(key, entry, pkg, repoRoot));
  }

  for (const key of Object.keys(exceptions)) {
    if (!packagesByKey.has(key)) {
      errors.push(`${key}: exception references a package not present in the audit universe (stale)`);
    }
  }

  return errors;
}

/**
 * Resolve final license disposition for a package, applying validated exceptions.
 * Invalid or incomplete exceptions never bypass policy.
 */
export function resolvePackageLicenseRecord(pkg, exception, exceptionErrors = []) {
  const declaredLicense = pkg.license ?? null;
  const declaredClassification = classifyLicenseExpression(declaredLicense);
  const baseRecord = {
    name: pkg.name,
    version: pkg.version,
    declaredLicense,
    declaredClassification,
  };

  if (!exception || exceptionErrors.length > 0) {
    return baseRecord;
  }

  const exceptionSummary = summarizeException(exception);
  const effectiveLicense =
    typeof exception.effectiveLicense === "string" && exception.effectiveLicense.trim().length > 0
      ? exception.effectiveLicense.trim()
      : declaredLicense;
  const effectiveClassification = classifyLicenseExpression(effectiveLicense);

  if (declaredClassification === "disallowed" || effectiveClassification === "disallowed") {
    return {
      ...baseRecord,
      ...(effectiveLicense !== declaredLicense ? { effectiveLicense } : {}),
      ...(effectiveClassification !== declaredClassification
        ? { effectiveClassification }
        : {}),
      exception: exceptionSummary,
    };
  }

  if (declaredClassification === "unknown") {
    if (exception.disposition !== "accepted" || effectiveClassification === "unknown") {
      return {
        ...baseRecord,
        ...(effectiveLicense !== declaredLicense ? { effectiveLicense } : {}),
        ...(effectiveClassification !== declaredClassification
          ? { effectiveClassification }
          : {}),
        exception: exceptionSummary,
      };
    }

    return {
      ...baseRecord,
      effectiveLicense,
      effectiveClassification,
      disposition: "accepted",
      exception: exceptionSummary,
    };
  }

  if (declaredClassification === "review-required") {
    if (exception.disposition !== "accepted") {
      return {
        ...baseRecord,
        exception: exceptionSummary,
      };
    }

    return {
      ...baseRecord,
      disposition: "accepted",
      exception: exceptionSummary,
    };
  }

  if (declaredClassification === "allowed") {
    return {
      ...baseRecord,
      disposition: exception.disposition === "accepted" ? "accepted" : undefined,
      exception: exceptionSummary,
    };
  }

  return baseRecord;
}

function summarizeException(exception) {
  return {
    status: exception.status,
    reason: exception.reason,
    reviewedOn: exception.reviewedOn,
    effectiveLicense: exception.effectiveLicense,
    source: exception.source,
    disposition: exception.disposition,
  };
}
