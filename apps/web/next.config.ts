import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The engine ships raw TypeScript source from the workspace.
  transpilePackages: ["@rotochess/engine"],
  // The engine uses ESM ".js" import specifiers against .ts sources
  // (future-proof for its compiled open-source release); teach webpack.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json", ".mjs"],
  },
};

export default nextConfig;
