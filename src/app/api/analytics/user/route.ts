import { NextRequest, NextResponse } from "next/server";
import { getUserAnalytics } from "@/lib/analytics-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const daysParam = searchParams.get("days");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const days = daysParam ? Number(daysParam) : undefined;
  if (daysParam && (!Number.isFinite(days) || (days ?? 0) <= 0)) {
    return NextResponse.json({ error: "days must be a positive number" }, { status: 400 });
  }

  try {
    const analytics = await getUserAnalytics(userId, { days });
    return NextResponse.json(analytics, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
