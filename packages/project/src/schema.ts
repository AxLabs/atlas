import { z } from "zod";

import { LATEST_SCHEMA_VERSION, SUPPORTED_SCHEMA_VERSIONS } from "./constants";
import {
  AtlasContractError,
  AtlasContractErrorCode,
  formatUnsupportedSchemaVersion,
  formatValidationErrors,
} from "./errors";

const repoRelativePath = z
  .string()
  .min(1)
  .refine((value) => !value.includes("\\"), "Path must use forward slashes")
  .refine((value) => !pathLooksAbsolute(value), "Path must be repository-relative")
  .refine((value) => !value.split("/").includes(".."), "Path must not contain parent segments");

function pathLooksAbsolute(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:/.test(value);
}

const applicationSchema = z
  .object({
    root: repoRelativePath,
  })
  .strict();

const featuresSchema = z
  .object({
    product: repoRelativePath,
    reference: repoRelativePath,
    examples: repoRelativePath,
  })
  .strict();

const referenceSchema = z
  .object({
    components: repoRelativePath,
    routes: repoRelativePath,
  })
  .strict();

const uiSchema = z
  .object({
    package: z.string().min(1),
    path: repoRelativePath,
    sourceImports: z.boolean(),
  })
  .strict();

const openApiGeneratedSchema = z
  .object({
    spec: repoRelativePath,
    schema: repoRelativePath,
  })
  .strict();

const generatedSchema = z
  .object({
    openApi: openApiGeneratedSchema,
  })
  .strict();

const capabilitiesSchema = z
  .object({
    auth: z.boolean(),
    consent: z.boolean(),
    analytics: z.boolean(),
    featureFlags: z.boolean(),
    i18n: z.boolean(),
    openApi: z.boolean(),
    observability: z.boolean(),
  })
  .strict();

const boundariesSchema = z
  .object({
    noFeatureToFeatureImports: z.boolean(),
    noProductImportsFromReference: z.boolean(),
    uiPublicApiOnly: z.boolean(),
  })
  .strict();

export const atlasProjectContractSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    application: applicationSchema.partial().optional(),
    features: featuresSchema.partial().optional(),
    reference: referenceSchema.partial().optional(),
    ui: uiSchema.partial().optional(),
    generated: z
      .object({
        openApi: openApiGeneratedSchema.partial(),
      })
      .strict()
      .optional(),
    capabilities: capabilitiesSchema.partial().optional(),
    boundaries: boundariesSchema.partial().optional(),
  })
  .strict();

export type RawAtlasProjectContract = z.infer<typeof atlasProjectContractSchema>;

export const resolvedApplicationSchema = applicationSchema;
export const resolvedFeaturesSchema = featuresSchema;
export const resolvedReferenceSchema = referenceSchema;
export const resolvedUiSchema = uiSchema;
export const resolvedGeneratedSchema = generatedSchema;
export const resolvedCapabilitiesSchema = capabilitiesSchema;
export const resolvedBoundariesSchema = boundariesSchema;

export const resolvedAtlasProjectSchema = z
  .object({
    schemaVersion: z.literal(LATEST_SCHEMA_VERSION),
    application: resolvedApplicationSchema,
    features: resolvedFeaturesSchema,
    reference: resolvedReferenceSchema,
    ui: resolvedUiSchema,
    generated: resolvedGeneratedSchema,
    capabilities: resolvedCapabilitiesSchema,
    boundaries: resolvedBoundariesSchema,
  })
  .strict();

export type ResolvedAtlasProject = z.infer<typeof resolvedAtlasProjectSchema>;

export function parseAtlasProjectContract(raw: unknown): RawAtlasProjectContract {
  const result = atlasProjectContractSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const pathLabel = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${pathLabel}: ${issue.message}`;
    });

    throw new AtlasContractError(
      AtlasContractErrorCode.CONTRACT_VALIDATION_FAILED,
      formatValidationErrors(errors),
      errors
    );
  }

  if (!SUPPORTED_SCHEMA_VERSIONS.includes(result.data.schemaVersion as 1)) {
    throw new AtlasContractError(
      AtlasContractErrorCode.CONTRACT_UNSUPPORTED_VERSION,
      formatUnsupportedSchemaVersion(result.data.schemaVersion)
    );
  }

  return result.data;
}
