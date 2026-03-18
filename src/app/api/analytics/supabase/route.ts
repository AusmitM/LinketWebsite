// app/api/analytics/supabase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRouteAccess } from "@/lib/api-authorization";
import { getUserAnalytics } from "@/lib/analytics-service";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";
import { validateSearchParams } from "@/lib/request-validation";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

function buildEmptyTimeline(days: number, timezoneOffsetMinutes: number) {
  const localNow = new Date(Date.now() - timezoneOffsetMinutes * MINUTE_MS);
  const localTodayStartMs = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate()
  );
  const startLocalDayMs = localTodayStartMs - (days - 1) * DAY_MS;
  const points = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(startLocalDayMs + i * DAY_MS);
    points.push({ date: formatIsoDay(day), scans: 0, leads: 0 });
  }
  return points;
}

function formatIsoDay(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTimezoneOffsetMinutes(value: string | null) {
  const parsed = Number.parseInt(value ?? "0", 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(-840, Math.min(840, parsed));
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
        id: "publish_profile",
        label: "Publish profile",
        completed: false,
        detail: "Activate one public profile.",
      },
      {
        id: "publish_lead_form",
        label: "Publish lead form",
        completed: false,
        detail: "Publish your lead form to collect contacts.",
      },
      {
        id: "set_handle",
        label: "Set handle",
        completed: false,
        detail: "Choose a custom public handle.",
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
    ],
    completedCount: 0,
    totalCount: 5,
    progress: 0,
  };
}

const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(30),
  tzOffsetMinutes: z.coerce.number().int().min(-840).max(840).optional().default(0),
  userId: z.string().uuid(),
});

type LeadRow = {
  company: string | null;
  created_at: string;
  email: string | null;
  id: string;
  message: string | null;
  name: string | null;
  phone: string | null;
};

export async function GET(request: NextRequest) {
  const parsedQuery = validateSearchParams(
    request.nextUrl.searchParams,
    analyticsQuerySchema
  );
  if (!parsedQuery.ok) {
    return parsedQuery.response;
  }

  const { days, tzOffsetMinutes, userId } = parsedQuery.data;
  const timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(
    String(tzOffsetMinutes)
  );

  try {
    const access = await requireRouteAccess("GET /api/analytics/supabase", {
      resourceUserId: userId,
    });
    if (access instanceof NextResponse) {
      return access;
    }

    if (isSupabaseAdminAvailable) {
      const analytics = await getUserAnalytics(userId, {
        days,
        timezoneOffsetMinutes,
      });
      return NextResponse.json(analytics, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    const supabase = await createServerSupabase();
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
      timeline: buildEmptyTimeline(days, timezoneOffsetMinutes),
      topProfiles: [],
      topLinks: [],
      recentLeads: ((leads ?? []) as LeadRow[]).map((lead) => ({
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
