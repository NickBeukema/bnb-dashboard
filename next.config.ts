import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    WAVESONG_ICAL_URL: process.env.WAVESONG_ICAL_URL,
    RED_ICAL_URL: process.env.RED_ICAL_URL,
    LAKE_BREEZE_ICAL_URL: process.env.LAKE_BREEZE_ICAL_URL,
    BETSIE_ICAL_URL: process.env.BETSIE_ICAL_URL,
    BETSIE_AIRBNB_ICAL_URL: process.env.BETSIE_AIRBNB_ICAL_URL,
  },
};

export default nextConfig;
