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
