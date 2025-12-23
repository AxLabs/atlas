/**
 * Next.js Instrumentation
 *
 * This file is automatically loaded by Next.js before any other code.
 * It's the proper place to initialize global instrumentation like Sentry.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only load Sentry on server-side (not in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  // Edge runtime loads sentry.edge.config automatically
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
