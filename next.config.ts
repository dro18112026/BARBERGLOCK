import type { NextConfig } from "next";

// Portability: keep this config host-agnostic. Cache Components / PPR are left
// off on purpose — they need host-specific caching infrastructure and this app
// is small and fully dynamic. Netlify, Vercel, Cloudflare (OpenNext) and a plain
// `next start` server all run this config unchanged.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
