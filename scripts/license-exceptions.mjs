import { classifyLicenseExpression } from "./license-policy.mjs";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidReviewedOn(value) {
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

  if (!isValidReviewedOn(entry.reviewedOn)) {
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

export function validateExceptions(exceptions, packagesByKey) {
  const errors = [];

  for (const [key, entry] of Object.entries(exceptions)) {
    errors.push(...validateExceptionEntry(key, entry, { package: packagesByKey.get(key) }));
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
    classification: declaredClassification,
  };

  if (!exception || exceptionErrors.length > 0) {
    return baseRecord;
  }

  const effectiveLicense =
    typeof exception.effectiveLicense === "string" && exception.effectiveLicense.trim().length > 0
      ? exception.effectiveLicense.trim()
      : declaredLicense;
  const effectiveClassification = classifyLicenseExpression(effectiveLicense);

  if (declaredClassification === "disallowed" || effectiveClassification === "disallowed") {
    return {
      ...baseRecord,
      classification: "disallowed",
      exception: summarizeException(exception),
    };
  }

  if (declaredClassification === "unknown") {
    if (exception.disposition !== "accepted" || effectiveClassification === "unknown") {
      return {
        ...baseRecord,
        classification: effectiveClassification === "unknown" ? "unknown" : declaredClassification,
        exception: summarizeException(exception),
      };
    }

    return {
      ...baseRecord,
      declaredLicense: effectiveLicense,
      classification: effectiveClassification,
      disposition: "accepted",
      exception: summarizeException(exception),
    };
  }

  if (declaredClassification === "review-required") {
    if (exception.disposition !== "accepted") {
      return {
        ...baseRecord,
        classification: "review-required",
        exception: summarizeException(exception),
      };
    }

    return {
      ...baseRecord,
      classification: "allowed",
      disposition: "accepted",
      exception: summarizeException(exception),
    };
  }

  if (declaredClassification === "allowed") {
    return {
      ...baseRecord,
      disposition: exception.disposition === "accepted" ? "accepted" : undefined,
      exception: summarizeException(exception),
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
