import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Pi runs the dev server, and phones reach it over Tailscale or the home network.
  // Next only serves dev scripts to localhost unless the other hostnames are listed here.
  allowedDevOrigins: ["100.117.241.60", "raspberrypi", "raspberrypi.local", "**.ts.net", "192.168.*.*"],
  env: {
    WAVESONG_ICAL_URL: process.env.WAVESONG_ICAL_URL,
    RED_ICAL_URL: process.env.RED_ICAL_URL,
    LAKE_BREEZE_ICAL_URL: process.env.LAKE_BREEZE_ICAL_URL,
    BETSIE_ICAL_URL: process.env.BETSIE_ICAL_URL,
    BETSIE_AIRBNB_ICAL_URL: process.env.BETSIE_AIRBNB_ICAL_URL,
  },
};

export default nextConfig;
