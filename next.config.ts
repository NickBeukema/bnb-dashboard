import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The board lives at /v3 (the kiosk's URL); send the bare address there too
  async redirects() {
    return [{ source: "/", destination: "/v3", permanent: false }];
  },
};

export default nextConfig;
