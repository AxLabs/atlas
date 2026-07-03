import { z } from "zod";

import { ServerEnvSchema } from "./server-runtime-config";

/**
 * Server schema with production-only requirements.
 *
 * DATABASE_URL is optional for local frontend/demo development but required
 * when NODE_ENV is production (CI and deployment).
 */
export function getServerEnvSchema(nodeEnv: string) {
  if (nodeEnv === "production") {
    return z.object({
      ...ServerEnvSchema,
      DATABASE_URL: z.string().url(),
    });
  }

  return z.object(ServerEnvSchema);
}
