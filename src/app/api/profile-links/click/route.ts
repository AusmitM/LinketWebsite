import { NextRequest, NextResponse } from "next/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      linkId?: string;
    };
    if (!body.linkId) {
      return NextResponse.json(
        { error: "linkId is required" },
        { status: 400 }
      );
    }

    if (!isSupabaseAdminAvailable) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const { error } = await supabaseAdmin.rpc(
      "increment_profile_link_click",
      { p_link_id: body.linkId }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to track link click",
      },
      { status: 500 }
    );
  }
}
