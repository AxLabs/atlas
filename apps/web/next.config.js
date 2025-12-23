const { withSentryConfig } = require("@sentry/nextjs");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@atlas/ui"],
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // Externalize pino to avoid bundling test dependencies
  serverExternalPackages: ["pino", "pino-pretty"],
  // Empty turbopack config to acknowledge Turbopack while using webpack plugins
  turbopack: {},
  // Enable instrumentation for Sentry
  experimental: {
    instrumentationHook: true,
  },
};

// Apply bundle analyzer first
let config = withBundleAnalyzer(nextConfig);

// Only apply Sentry build plugin if auth token is present
// This ensures builds don't fail when Sentry env vars are missing
const shouldEnableSentryPlugin =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT;

if (shouldEnableSentryPlugin) {
  config = withSentryConfig(config, {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // Upload sourcemaps during production builds
    widenClientFileUpload: true,

    // Automatically annotate React components to show their full name in breadcrumbs and session replay
    reactComponentAnnotation: {
      enabled: true,
    },

    // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    // tunnelRoute: "/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  });
}

module.exports = config;
