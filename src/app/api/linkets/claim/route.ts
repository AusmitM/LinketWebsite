import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { limitHit } from "@/lib/rate-limit";
// import { getServerSession } from "SERVER_SESSION_HELPER"; // TODO: replace with actual session getter

const Schema = z.object({
  token: z.string().min(8).max(64),
  claim_code: z.string().max(32).optional()
});

export async function POST(req: NextRequest) {
  // const session = await getServerSession();
  // if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // TODO: Add session validation when available

  const body = await req.json().catch(()=>null);
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "bad_input" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  if (await limitHit(`claim:${p.data.token}:${ip}`, 5, 60_000))
    return NextResponse.json({ error: "too_many" }, { status: 429 });

  const { data, error } = await supabaseAdmin.rpc("claim_hardware_tag_flexible", {
    p_token: p.data.token,
    p_claim_code: p.data.claim_code ?? null
  });
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });
  if (!data?.claimed) return NextResponse.json({ error: "no_match", hint: "try_backup_code" }, { status: 409 });

  await supabaseAdmin.from("tag_events").insert({ tag_id: data.tag_id, event_type: "claim" });
  await fetch(`/api/internal/purge-cache?token=${encodeURIComponent(p.data.token)}`, { method:"POST", headers:{ "x-internal-secret": process.env.INTERNAL_SECRET! }}).catch(()=>{});
  return NextResponse.json({ ok: true });
}
