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
  // Experimental features
  experimental: {
    // Enable CSP nonces for Next.js inline scripts
    // This makes Next.js read the nonce from headers.get('x-nonce')
    // and apply it to all its inline scripts (__NEXT_DATA__, etc.)
    cspNonces: ["x-nonce"],
  },
  // Security headers baseline
  async headers() {
    // Determine if HSTS should be enabled (production only with HTTPS)
    const enableHSTS = process.env.ENABLE_HSTS === "true" && process.env.NODE_ENV === "production";

    const securityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin",
      },
      {
        key: "Cross-Origin-Resource-Policy",
        value: "same-site",
      },
    ];

    // Add HSTS if enabled
    if (enableHSTS) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }

    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
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
