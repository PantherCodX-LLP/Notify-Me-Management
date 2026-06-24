/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a minimal self-contained server in .next/standalone for small,
  // fast production Docker images.
  output: "standalone",
  // mysql2 is a server-only dependency; keep it external to the server bundle.
  experimental: {
    serverComponentsExternalPackages: ["mysql2"],
  },
};

module.exports = nextConfig;
