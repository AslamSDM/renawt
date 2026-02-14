import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude Remotion SSR packages from client-side bundling
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "esbuild",
  ],

  // Configure external image domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-d842b814c7c64f5caefc4f21e1f4ef6b.r2.dev",
        pathname: "/**",
      },
      // Allow all hostnames for scraped logos and images
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },

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

    // Exclude eg directory from bundling
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [...(config.watchOptions?.ignored || []), "**/eg/**"],
    };

    return config;
  },
};

export default nextConfig;
