import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.HYDROPOP_NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
