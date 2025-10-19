import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { kvDel } from "@/lib/kv";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-internal-secret") !== process.env.INTERNAL_SECRET)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const u = new URL(req.url);
  const token = u.searchParams.get("token");
  if (token) await kvDel(`hw:${token}`);
  return NextResponse.json({ ok: true });
}
