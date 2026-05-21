import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runs on Cloudflare Pages via @opennextjs/cloudflare
  // Use `npx opennextjs-cloudflare` to build for CF Pages deployment
  experimental: {
    // Keep server components working with workspace packages
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;
