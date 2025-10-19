import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const locked = process.env.PREVIEW_LOCK === "1";
  if (locked) {
    return {
      rules: [{ userAgent: "*", disallow: ["/"] }],
    };
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: ["/"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
