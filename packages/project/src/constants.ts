/** Canonical filename for the author-written Atlas project contract at the repository root. */
export const ATLAS_CONTRACT_FILENAME = "atlas.config.json";

/** Contract schema versions this loader understands. */
export const SUPPORTED_SCHEMA_VERSIONS = [1] as const;

export type SupportedSchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

export const LATEST_SCHEMA_VERSION: SupportedSchemaVersion = 1;
