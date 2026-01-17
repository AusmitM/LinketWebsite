// app/api/analytics/supabase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserAnalyticsData } from "@/lib/supabase-analytics";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";

function buildEmptyTimeline(days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - (days - 1));
  const points = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    points.push({ date: day.toISOString().slice(0, 10), scans: 0, leads: 0 });
  }
  return points;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const days = parseInt(searchParams.get("days") || "30", 10);

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (auth.user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isSupabaseAdminAvailable) {
      const analytics = await getUserAnalyticsData(userId, days);
      return NextResponse.json(analytics, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id,name,email,phone,company,message,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (leadsError) {
      throw new Error(leadsError.message);
    }

    const analytics = {
      meta: { available: false, generatedAt: new Date().toISOString() },
      totals: {
        scansToday: 0,
        leadsToday: 0,
        scans7d: 0,
        leads7d: 0,
        conversionRate7d: 0,
        activeTags: 0,
        lastScanAt: null,
      },
      timeline: buildEmptyTimeline(days),
      topProfiles: [],
      recentLeads: (leads ?? []).map((lead) => ({
        id: lead.id,
        name: lead.name ?? null,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        company: lead.company ?? null,
        message: lead.message ?? null,
        created_at: lead.created_at,
      })),
    };

    return NextResponse.json(analytics, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Analytics API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch analytics",
        meta: { available: false, generatedAt: new Date().toISOString() },
      },
      { status: 500 }
    );
  }
}
