import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/editor/",
          "/profile/",
          "/signin/",
          "/record/",
          "/templates/",
        ],
      },
    ],
    sitemap: "https://remawt.com/sitemap.xml",
  };
}
