/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@atlas/ui"],
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  eslint: {
    dirs: ["src"],
  },
};

module.exports = nextConfig;
