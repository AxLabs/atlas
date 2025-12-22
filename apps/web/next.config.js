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
};

module.exports = withBundleAnalyzer(nextConfig);
