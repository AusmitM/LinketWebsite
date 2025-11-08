// app/api/analytics/user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { processUserAnalytics } from "@/lib/supabase-analytics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const daysParam = searchParams.get("days");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const days = daysParam ? Number(daysParam) : 30;
  if (daysParam && (!Number.isFinite(days) || days <= 0)) {
    return NextResponse.json(
      { error: "days must be a positive number" },
      { status: 400 }
    );
  }

  try {
    console.log(
      `[Analytics API] Fetching analytics for user ${userId} (${days} days)`
    );

    // Fetch analytics from Supabase
    const analytics = await processUserAnalytics(userId, days);

    console.log(`[Analytics API] Successfully retrieved analytics:`, {
      scansToday: analytics.totals?.scansToday,
      leadsToday: analytics.totals?.leadsToday,
      timelinePoints: analytics.timeline.length,
      topProfiles: analytics.topProfiles.length,
      recentLeads: analytics.recentLeads.length,
    });

    return NextResponse.json(analytics, { status: 200 });
  } catch (error) {
    console.error("[Analytics API] Error fetching analytics:", error);
    const message =
      error instanceof Error ? error.message : "Unable to load analytics";

    // Return a graceful error response
    return NextResponse.json(
      {
        error: message,
        meta: {
          available: false,
          generatedAt: new Date().toISOString(),
        },
        totals: null,
        timeline: [],
        topProfiles: [],
        recentLeads: [],
      },
      { status: 200 }
    );
  }
}
