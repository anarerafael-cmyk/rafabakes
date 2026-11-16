import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Product photos are shrunk in the browser before upload; this leaves headroom.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
