import { NextResponse } from "next/server"
import { getDashboardSummary, type DashboardSummary } from "@/lib/mock-data"

export const dynamic = "force-static"
export const revalidate = 60

export async function GET() {
  const data: DashboardSummary = getDashboardSummary()
  return NextResponse.json(data)
}

