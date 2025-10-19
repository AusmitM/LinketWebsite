import { NextRequest, NextResponse } from "next/server"
import { getDesigns, getDesignsPaged, type Design, type Paged } from "@/lib/mock-data"

export const dynamic = "force-static"
export const revalidate = 60

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = Number(searchParams.get("page") || 1)
  const pageSize = Number(searchParams.get("pageSize") || 8)
  const mode = searchParams.get("mode")
  if (mode === "all") {
    const all: Design[] = getDesigns()
    return NextResponse.json(all)
  }
  const data: Paged<Design> = getDesignsPaged(Number.isFinite(page) ? page : 1, Number.isFinite(pageSize) ? pageSize : 8)
  return NextResponse.json(data)
}

