// app/api/analytics/supabase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserAnalyticsData } from "@/lib/supabase-analytics";

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

    const analytics = await getUserAnalyticsData(userId, days);

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
