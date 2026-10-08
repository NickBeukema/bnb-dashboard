import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The board used to live at /v3; keep old bookmarks working
  async redirects() {
    return [{ source: "/v3", destination: "/", permanent: false }];
  },
  async headers() {
    return [
      {
        // Browsers must always check for a new worker, or a deploy could be hidden behind it
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
