import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Signed-in areas have nothing for search. /backend stays open: crawlers that run
        // JavaScript fetch page data through it.
        disallow: ["/admin", "/settings", "/profile", "/welcome", "/store", "/teams", "/blog/new", "/certification/review", "/contribute/questions"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
