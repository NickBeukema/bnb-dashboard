import { execSync } from "node:child_process";
import type { NextConfig } from "next";

// The commit being built. Every deploy pulls a new one, so open boards can tell they're behind.
function commit() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  // Inlined into the server and client bundles at build time (see src/lib/version.ts)
  env: { BUILD_ID: commit() },
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
