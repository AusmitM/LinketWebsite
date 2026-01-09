import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

const MIN_QTY = 1;
const MAX_QTY = 20000;
const LABEL_MAX = 64;

function sanitizeLabel(raw: string) {
  return raw.trim().slice(0, LABEL_MAX);
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
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
  const qtyRaw = searchParams.get("qty");
  const labelRaw = searchParams.get("label") ?? "";
  const qtyParsed = Number(qtyRaw);
  if (!Number.isFinite(qtyParsed) || qtyParsed < MIN_QTY || qtyParsed > MAX_QTY) {
    return NextResponse.json(
      { error: `Quantity must be between ${MIN_QTY} and ${MAX_QTY}.` },
      { status: 400 }
    );
  }

  const label = sanitizeLabel(labelRaw);
  const safeLabel = label || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin.rpc("mint_linkets_csv", {
    p_qty: Math.trunc(qtyParsed),
    p_batch_label: label || null,
  });
  if (error) {
    return NextResponse.json(
      { error: error.message || "Mint failed." },
      { status: 500 }
    );
  }

  const columns = [
    "id",
    "public_token",
    "url",
    "claim_code",
    "claim_code_display",
    "batch_id",
    "batch_label",
  ];
  const rows = Array.isArray(data) ? data : [];
  const csv = [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((key) => csvEscape((row as Record<string, unknown>)[key])).join(",")
    ),
  ].join("\n");

  const filename = `linkets_${safeLabel.replace(/\s+/g, "_")}_${Math.trunc(qtyParsed)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
