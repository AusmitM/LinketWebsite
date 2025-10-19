import { NextResponse } from "next/server"
import { getActivity, type ActivityItem } from "@/lib/mock-data"

export const dynamic = "force-static"
export const revalidate = 60

export async function GET() {
  const data: ActivityItem[] = getActivity()
  return NextResponse.json(data)
}

