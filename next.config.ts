import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The board used to live at /v3; keep old bookmarks working
  async redirects() {
    return [{ source: "/v3", destination: "/", permanent: false }];
  },
};

export default nextConfig;
