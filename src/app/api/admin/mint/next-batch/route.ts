import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

const LABEL_MAX = 64;

function sanitizeLabel(raw: string) {
  return raw.trim().slice(0, LABEL_MAX);
}

function getUtcDayBounds(value: string | null) {
  const dt = value ? new Date(value) : new Date();
  if (Number.isNaN(dt.getTime())) return null;
  const start = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { start, end };
}

export async function GET(req: NextRequest) {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json(
      { error: "Admin minting is not configured." },
      { status: 500 }
    );
  }

  const supabase = await createServerSupabaseReadonly();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminRows, error: adminError } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .limit(1);
  if (adminError || !adminRows || adminRows.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rawLabel = sanitizeLabel(searchParams.get("label") ?? "");
  const dateHint = rawLabel || new Date().toISOString().slice(0, 10);
  const bounds = getUtcDayBounds(dateHint);
  if (!bounds) {
    return NextResponse.json(
      { error: "Invalid batch label date." },
      { status: 400 }
    );
  }

  const { count, error: countError } = await supabaseAdmin
    .from("hardware_tag_batches")
    .select("id", { count: "exact", head: true })
    .gte("created_at", bounds.start.toISOString())
    .lt("created_at", bounds.end.toISOString());

  if (countError) {
    return NextResponse.json(
      { error: countError.message || "Unable to read batches." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    nextIndex: (count ?? 0) + 1,
    date: bounds.start.toISOString().slice(0, 10),
  });
}
