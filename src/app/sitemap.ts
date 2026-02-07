import type { MetadataRoute } from "next";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { getConfiguredSiteOrigin } from "@/lib/site-url";

const STATIC_ROUTES = ["/", "/accessibility", "/privacy", "/security", "/terms"] as const;

type PublicHandleRow = {
  handle: string | null;
  updated_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locked = process.env.PREVIEW_LOCK === "1";
  if (locked) return [];

  const base = getConfiguredSiteOrigin();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  for (const route of STATIC_ROUTES.slice(1)) {
    entries.push({
      url: `${base}${route}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  try {
    const supabase = await createServerSupabaseReadonly();
    const { data, error } = await supabase
      .from("user_profiles")
      .select("handle, updated_at")
      .eq("is_active", true)
      .not("handle", "is", null);

    if (!error) {
      const seen = new Set<string>();
      for (const row of (data ?? []) as PublicHandleRow[]) {
        const handle = row.handle?.trim().toLowerCase();
        if (!handle || seen.has(handle)) continue;
        seen.add(handle);
        entries.push({
          url: `${base}/${encodeURIComponent(handle)}`,
          lastModified: row.updated_at ? new Date(row.updated_at) : now,
          changeFrequency: "daily",
          priority: 0.8,
        });
      }
    }
  } catch {
    // Ignore sitemap profile fetch failures and keep static entries.
  }

  return entries;
}
