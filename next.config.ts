import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude Remotion SSR packages from client-side bundling
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "esbuild",
  ],

  // Empty turbopack config to silence warning (Turbopack is default in Next 16)
  turbopack: {},

  // Webpack config for when running with --webpack flag
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle these on server - use native require
      config.externals = config.externals || [];
      config.externals.push(
        "@remotion/bundler",
        "@remotion/renderer",
        "esbuild",
      );
    }

    // Ignore .md files in node_modules
    config.module.rules.push({
      test: /\.md$/,
      type: "asset/source",
    });

    return config;
  },
};

export default nextConfig;
