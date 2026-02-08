// app/api/analytics/supabase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserAnalytics } from "@/lib/analytics-service";
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

function buildEmptyFunnel() {
  return {
    steps: [
      {
        key: "landing_cta_click",
        label: "Landing CTA click",
        eventCount: 0,
        firstAt: null,
        completed: false,
        conversionFromPrevious: null,
      },
      {
        key: "signup_start",
        label: "Signup start",
        eventCount: 0,
        firstAt: null,
        completed: false,
        conversionFromPrevious: null,
      },
      {
        key: "signup_complete",
        label: "Signup complete",
        eventCount: 0,
        firstAt: null,
        completed: false,
        conversionFromPrevious: null,
      },
      {
        key: "first_profile_publish",
        label: "First profile publish",
        eventCount: 0,
        firstAt: null,
        completed: false,
        conversionFromPrevious: null,
      },
      {
        key: "first_lead",
        label: "First lead",
        eventCount: 0,
        firstAt: null,
        completed: false,
        conversionFromPrevious: null,
      },
    ],
    completedSteps: 0,
    totalSteps: 5,
    completionRate: 0,
  };
}

function buildEmptyOnboarding() {
  return {
    items: [
      {
        id: "set_handle",
        label: "Set handle",
        completed: false,
        detail: "Choose a custom public handle.",
      },
      {
        id: "publish_profile",
        label: "Publish profile",
        completed: false,
        detail: "Activate one public profile.",
      },
      {
        id: "add_three_links",
        label: "Add 3 links",
        completed: false,
        detail: "0/3 links published.",
      },
      {
        id: "test_share",
        label: "Test share",
        completed: false,
        detail: "Use Share Contact or Save Contact once.",
      },
      {
        id: "publish_lead_form",
        label: "Publish lead form",
        completed: false,
        detail: "Publish your lead form to collect contacts.",
      },
    ],
    completedCount: 0,
    totalCount: 5,
    progress: 0,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsedDays = parseInt(searchParams.get("days") || "30", 10);
  const days = Number.isFinite(parsedDays)
    ? Math.max(1, Math.min(parsedDays, 90))
    : 30;

  try {
    const userId = searchParams.get("userId");

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
      const analytics = await getUserAnalytics(userId, { days });
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
      meta: { available: false, generatedAt: new Date().toISOString(), days },
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
      funnel: buildEmptyFunnel(),
      onboarding: buildEmptyOnboarding(),
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
        meta: { available: false, generatedAt: new Date().toISOString(), days },
      },
      { status: 500 }
    );
  }
}
