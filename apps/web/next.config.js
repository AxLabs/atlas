/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@thedanielmark/ui"],
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    dirs: ["src"],
  },
};

module.exports = nextConfig;
