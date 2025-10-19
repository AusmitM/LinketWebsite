import { NextResponse } from "next/server"
import { getMessages, type MessageThread } from "@/lib/mock-data"

export const dynamic = "force-static"
export const revalidate = 60

export async function GET() {
  const data: MessageThread[] = getMessages()
  return NextResponse.json(data)
}

