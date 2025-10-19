import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
// import { getServerSession } from "SERVER_SESSION_HELPER"; // TODO: replace session getter

export async function POST(req: NextRequest, context: { params: Promise<{ profileId: string }> }) {
  const params = await context.params;
  // TODO: Add session validation when available

  const { data: p } = await supabaseAdmin.from("user_profiles").select("id,user_id").eq("id", params.profileId).single();
  if (!p) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin.rpc("set_primary_profile", { p_profile_id: params.profileId });
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
