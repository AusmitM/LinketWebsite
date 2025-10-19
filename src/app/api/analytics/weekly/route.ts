import { NextRequest, NextResponse } from "next/server"
import { getWeeklyAnalytics, type WeeklyAnalytics } from "@/lib/mock-data"

export const dynamic = "force-static"
export const revalidate = 60

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = Number(searchParams.get("days") || 7)
  const data: WeeklyAnalytics = getWeeklyAnalytics(Number.isFinite(days) ? days : 7)
  return NextResponse.json(data)
}

