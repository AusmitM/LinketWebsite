import { NextResponse } from "next/server"
import { getOrders, type Order } from "@/lib/mock-data"

export const dynamic = "force-static"
export const revalidate = 60

export async function GET() {
  const data: Order[] = getOrders()
  return NextResponse.json(data)
}

