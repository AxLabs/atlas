/**
 * Reference mode resolution and production safety guards.
 *
 * @module config/reference
 */

import { clientEnv, serverEnv } from "@/env";

/**
 * Error thrown when reference mode is requested in a production context.
 */
export class ReferenceModeForbiddenError extends Error {
  constructor(message = "Reference mode cannot be enabled in production") {
    super(message);
    this.name = "ReferenceModeForbiddenError";
  }
}

/**
 * Returns true when ATLAS_REFERENCE_MODE is explicitly set to "true".
 */
export function isReferenceModeRequested(): boolean {
  return serverEnv.ATLAS_REFERENCE_MODE === true;
}

/**
 * Returns true when reference adapters are active for this process.
 */
export function isReferenceModeEnabled(): boolean {
  if (!isReferenceModeRequested()) {
    return false;
  }

  const appEnv = clientEnv.NEXT_PUBLIC_APP_ENV ?? "development";

  if (appEnv === "production" || serverEnv.NODE_ENV === "production") {
    return false;
  }

  return true;
}

/**
 * Assert reference mode is enabled; throws if adapters are unavailable.
 */
export function assertReferenceModeEnabled(): void {
  if (isReferenceModeRequested() && !isReferenceModeEnabled()) {
    throw new ReferenceModeForbiddenError();
  }

  if (!isReferenceModeEnabled()) {
    throw new Error(
      "Reference mode is not enabled. Set ATLAS_REFERENCE_MODE=true for local development."
    );
  }
}

/**
 * Assert reference mode was not requested in production (env validation helper).
 */
export function assertReferenceModeAllowedInEnvironment(nodeEnv: string): void {
  if (nodeEnv === "production" && isReferenceModeRequested()) {
    throw new ReferenceModeForbiddenError(
      "ATLAS_REFERENCE_MODE cannot be enabled when NODE_ENV is production"
    );
  }
}
