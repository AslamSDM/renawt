import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/studio/",
          "/editor/",
          "/profile/",
          "/signin/",
          "/record/",
          "/dodotest/",
        ],
      },
    ],
    sitemap: "https://remawt.com/sitemap.xml",
  };
}
