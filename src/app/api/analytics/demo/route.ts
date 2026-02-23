import { NextRequest, NextResponse } from "next/server";

import { getUserAnalytics } from "@/lib/analytics-service";
import { createServerSupabase } from "@/lib/supabase/server";

function normalizeTimezoneOffsetMinutes(value: string | null) {
  const parsed = Number.parseInt(value ?? "0", 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(-840, Math.min(840, parsed));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");
  const timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(
    searchParams.get("tzOffsetMinutes")
  );

  if (!userId) {
    return NextResponse.json(
      { error: "userId parameter is required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServerSupabase();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (auth.user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const analytics = await getUserAnalytics(userId, {
      days: 30,
      recentLeadCount: 5,
      timezoneOffsetMinutes,
    });

    const scansInRange = analytics.timeline.reduce(
      (total, point) => total + point.scans,
      0
    );
    const leadsInRange = analytics.timeline.reduce(
      (total, point) => total + point.leads,
      0
    );
    const conversionInRange = scansInRange > 0 ? leadsInRange / scansInRange : 0;
    const topLinksTotalClicks = analytics.topLinks.reduce(
      (total, link) => total + link.clicks,
      0
    );

    const payload = {
      meta: {
        rangeDays: 30,
        generatedAt: analytics.meta.generatedAt,
        available: analytics.meta.available,
      },
      totals: {
        scansInRange,
        leadsInRange,
        conversionInRange,
        activeTags: analytics.totals.activeTags,
        lastScanAt: analytics.totals.lastScanAt,
      },
      timeline: analytics.timeline.map((point) => ({
        date: point.date,
        scans: point.scans,
        leads: point.leads,
      })),
      topProfiles: analytics.topProfiles.slice(0, 3).map((profile) => ({
        profileId: profile.profileId,
        handle: profile.handle,
        displayName: profile.displayName,
        scans: profile.scans,
        leads: profile.leads,
      })),
      topLinks: analytics.topLinks.slice(0, 3).map((link) => ({
        id: link.id,
        title: link.title,
        url: link.url,
        clicks: link.clicks,
        share:
          topLinksTotalClicks > 0 ? link.clicks / topLinksTotalClicks : 0,
      })),
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load analytics demo.",
      },
      { status: 500 }
    );
  }
}
