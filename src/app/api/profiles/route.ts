import { NextResponse } from "next/server"
import { getProfiles, type Profile } from "@/lib/mock-data"

export const dynamic = "force-static"
export const revalidate = 60

export async function GET() {
  const data: Profile[] = getProfiles()
  return NextResponse.json(data)
}

