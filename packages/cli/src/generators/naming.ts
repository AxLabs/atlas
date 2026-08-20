import { CliError, CliErrorCode } from "../errors/cli-error";

export interface FeatureNaming {
  kebab: string;
  camel: string;
  pascal: string;
}

function isKebabCaseSegment(segment: string): boolean {
  return /^[a-z0-9]+$/.test(segment);
}

export function validateKebabCaseName(value: string, label: string): void {
  if (value.length === 0) {
    throw new CliError(CliErrorCode.USAGE_ERROR, `${label} must not be empty.`);
  }

  if (value === "." || value === "..") {
    throw new CliError(CliErrorCode.USAGE_ERROR, `Invalid ${label}: ${value}`);
  }

  if (value.includes("/") || value.includes("\\")) {
    throw new CliError(CliErrorCode.USAGE_ERROR, `${label} must not contain path separators.`);
  }

  if (value.includes("..")) {
    throw new CliError(CliErrorCode.USAGE_ERROR, `${label} must not contain parent segments.`);
  }

  if (!/^[a-z]/.test(value)) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `${label} must use kebab-case (example: billing-history). Received: ${value}`
    );
  }

  const segments = value.split("-");
  if (segments.some((segment) => segment.length === 0 || !isKebabCaseSegment(segment))) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `${label} must use kebab-case (example: billing-history). Received: ${value}`
    );
  }
}

export function parseFeatureName(raw: string): FeatureNaming {
  validateKebabCaseName(raw, "Feature name");
  return {
    kebab: raw,
    camel: kebabToCamel(raw),
    pascal: kebabToPascal(raw),
  };
}

export function kebabToCamel(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_, segment: string) => segment.toUpperCase());
}

export function kebabToPascal(value: string): string {
  const camel = kebabToCamel(value);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

const STATIC_ROUTE_SEGMENT_PATTERN = /^[a-z][a-z0-9-]*$/;
const DYNAMIC_ROUTE_SEGMENT_PATTERN = /^\[[a-zA-Z_][a-zA-Z0-9_]*\]$/;

export function validateAppRouterRoute(raw: string): string {
  if (raw.length === 0) {
    throw new CliError(CliErrorCode.USAGE_ERROR, "Route must not be empty.");
  }

  if (raw.startsWith("/")) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "Route must be relative to the App Router root (do not start with /)."
    );
  }

  if (raw.includes("\\")) {
    throw new CliError(CliErrorCode.USAGE_ERROR, "Route must use forward slashes.");
  }

  if (raw.includes("//")) {
    throw new CliError(CliErrorCode.USAGE_ERROR, "Route must not contain empty segments.");
  }

  if (raw.includes("..")) {
    throw new CliError(CliErrorCode.USAGE_ERROR, "Route must not contain parent segments.");
  }

  const segments = raw.split("/");
  for (const segment of segments) {
    const isStatic = STATIC_ROUTE_SEGMENT_PATTERN.test(segment);
    const isDynamic = DYNAMIC_ROUTE_SEGMENT_PATTERN.test(segment);
    if (!isStatic && !isDynamic) {
      throw new CliError(
        CliErrorCode.USAGE_ERROR,
        `Invalid route segment: ${segment}. Use static segments (settings) or dynamic segments with identifier-safe names ([id], [userId]).`
      );
    }
  }

  return raw;
}

export function routeToPageTitle(route: string): string {
  return route
    .split("/")
    .map((segment) => {
      if (segment.startsWith("[") && segment.endsWith("]")) {
        return segment.slice(1, -1);
      }

      return segment
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    })
    .join(" — ");
}

export function routeToPageComponentName(route: string): string {
  const parts = route.split("/").flatMap((segment) => {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      return [kebabToPascal(segment.slice(1, -1))];
    }

    return segment.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  });

  return `${parts.join("")}Page`;
}
