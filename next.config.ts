import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withBotId(nextConfig);
