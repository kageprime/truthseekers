import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    viewTransition: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ioredis: false,
        dns: false,
        net: false,
        tls: false,
        "node:fs": false,
        "node:os": false,
        "node:path": false,
      };
    }
    return config;
  },
};

export default nextConfig;
