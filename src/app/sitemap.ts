import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const locked = process.env.PREVIEW_LOCK === "1";
  if (locked) return [];
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
