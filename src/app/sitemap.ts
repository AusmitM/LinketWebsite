import type { MetadataRoute } from "next";
import { DISCOVER_PAGES } from "@/config/discover-pages";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { getConfiguredSiteOrigin } from "@/lib/site-url";

type StaticSitemapRoute = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

const STATIC_ROUTES: readonly StaticSitemapRoute[] = [
  {
    path: "/",
    changeFrequency: "weekly",
    priority: 1,
  },
  ...DISCOVER_PAGES.map<StaticSitemapRoute>((page) => ({
    path: page.href,
    changeFrequency: "weekly",
    priority: 0.85,
  })),
  {
    path: "/accessibility",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/privacy",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/security",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/terms",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/warranty",
    changeFrequency: "monthly",
    priority: 0.6,
  },
];

type PublicHandleRow = {
  handle: string | null;
  updated_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locked = process.env.PREVIEW_LOCK === "1";
  if (locked) return [];

  const base = getConfiguredSiteOrigin();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

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
