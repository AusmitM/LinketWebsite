import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

const Schema = z.object({
  tag_id: z.string().uuid(),
  event_type: z.enum(["scan","vcard_dl","lead_submit","contact_click","claim","target_change","transfer"]),
  country: z.string().max(8).optional(),
  device: z.string().max(16).optional(),
  referrer: z.string().max(200).optional(),
  utm: z.record(z.string(), z.string()).optional(),
  ip_hash: z.string().length(64).optional(),
  metadata: z.unknown().optional()
});

export async function POST(req: NextRequest) {
  if (req.headers.get("x-internal-secret") !== process.env.INTERNAL_SECRET)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(()=>null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_input" }, { status: 400 });

  await supabaseAdmin.from("tag_events").insert(parsed.data);
  return NextResponse.json({ ok: true });
}
