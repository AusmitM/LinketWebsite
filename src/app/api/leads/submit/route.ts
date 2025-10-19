import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    // basic validation
    const { user_id, handle, name, email } = body as Record<string, unknown>;
    if (!user_id || !handle || !name || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!isSupabaseAdminAvailable) {
      return NextResponse.json({ error: "Supabase admin unavailable" }, { status: 503 });
    }

    // Try insert with service role to bypass client RLS/anon issues
    const { data, error } = await supabaseAdmin
      .from("leads")
      .insert(body)
      .select()
      .single();
    if (error) {
      const details = (error as { details?: string } | null)?.details;
      return NextResponse.json({ error: error.message, details }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
