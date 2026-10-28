import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@remawt/shared", "@remawt/db"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pub-d842b814c7c64f5caefc4f21e1f4ef6b.r2.dev", pathname: "/**" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  turbopack: {},
};

export default nextConfig;
