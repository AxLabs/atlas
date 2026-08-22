/**
 * Reference mode resolution for the Atlas reference application.
 *
 * The reference app is always in harness mode during local development and test.
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
 * Returns true when reference adapters are active for this process.
 */
export function isReferenceModeRequested(): boolean {
  return serverEnv.ATLAS_REFERENCE_MODE !== false;
}

/**
 * Returns true when reference adapters are active for this process.
 */
export function isReferenceModeEnabled(): boolean {
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
  if (!isReferenceModeEnabled()) {
    throw new ReferenceModeForbiddenError();
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
