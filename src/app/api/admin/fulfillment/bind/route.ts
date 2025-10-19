import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
// import { requireAdmin } from "RBAC_HELPER"; // TODO: use if available

const Schema = z.object({ items: z.array(z.object({ public_token: z.string().min(8), email: z.string().email() })).min(1) });

export async function POST(req: NextRequest) {
  // const session = await requireAdmin(); // TODO: RBAC helper
  const session = null as unknown; // TODO: server session getter + admin/support check, type properly
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(()=>null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_input" }, { status: 400 });

  for (const row of parsed.data.items) {
    const { error } = await supabaseAdmin.rpc("set_tag_fulfillment", { p_token: row.public_token, p_email: row.email });
    if (error) return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
