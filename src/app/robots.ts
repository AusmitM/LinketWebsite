import type { MetadataRoute } from "next";
import { getConfiguredSiteOrigin } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const locked = process.env.PREVIEW_LOCK === "1";
  if (locked) {
    return {
      rules: [{ userAgent: "*", disallow: ["/"] }],
    };
  }
  const base = getConfiguredSiteOrigin();
  return {
    rules: [{ userAgent: "*", allow: ["/"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
