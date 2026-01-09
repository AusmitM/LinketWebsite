import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

const LABEL_MAX = 64;

function sanitizeLabel(raw: string) {
  return raw.trim().slice(0, LABEL_MAX);
}

function getUtcDayBounds(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const start = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { start, end };
}

async function getBatchIndexForDay(batchId: string, createdAt: string) {
  const bounds = getUtcDayBounds(createdAt);
  if (!bounds) return null;

  const { data, error } = await supabaseAdmin
    .from("hardware_tag_batches")
    .select("id, created_at")
    .gte("created_at", bounds.start.toISOString())
    .lt("created_at", bounds.end.toISOString())
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error || !data) return null;
  const index = data.findIndex((row) => row.id === batchId);
  if (index === -1) return null;
  return index + 1;
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function formatClaimCode(value: string | null | undefined) {
  const cleaned = value?.replace(/-/g, "").toUpperCase() ?? "";
  if (!cleaned) return "";
  return [cleaned.slice(0, 4), cleaned.slice(4, 8), cleaned.slice(8, 12)]
    .filter(Boolean)
    .join("-");
}

function getSiteBase() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://linketconnect.com").replace(/\/$/, "");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
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

  const { batchId: rawBatchId } = await params;
  const batchId = rawBatchId?.trim();
  if (!batchId) {
    return NextResponse.json({ error: "Batch id is required." }, { status: 400 });
  }

  const { data: batch, error: batchError } = await supabaseAdmin
    .from("hardware_tag_batches")
    .select("id,label,created_at")
    .eq("id", batchId)
    .limit(1)
    .maybeSingle();

  if (batchError) {
    return NextResponse.json(
      { error: batchError.message || "Unable to load batch." },
      { status: 500 }
    );
  }
  if (!batch) {
    return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  }

  const { data: tags, error: tagsError } = await supabaseAdmin
    .from("hardware_tags")
    .select("id, public_token, claim_code, batch_id, created_at")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });

  if (tagsError) {
    return NextResponse.json(
      { error: tagsError.message || "Unable to load batch tags." },
      { status: 500 }
    );
  }

  const safeLabel =
    sanitizeLabel(batch.label ?? "") ||
    batch.created_at?.slice(0, 10) ||
    `batch_${batch.id.slice(0, 8)}`;
  const baseUrl = getSiteBase();

  const columns = [
    "id",
    "public_token",
    "url",
    "claim_code",
    "claim_code_display",
    "batch_id",
    "batch_label",
  ];

  const rows = Array.isArray(tags) ? tags : [];
  const csv = [
    columns.join(","),
    ...rows.map((row) => {
      const record = {
        id: row.id,
        public_token: row.public_token,
        url: row.public_token ? `${baseUrl}/l/${row.public_token}` : "",
        claim_code: row.claim_code ?? "",
        claim_code_display: formatClaimCode(row.claim_code),
        batch_id: row.batch_id,
        batch_label: safeLabel,
      };
      return columns.map((key) => csvEscape(record[key as keyof typeof record])).join(",");
    }),
  ].join("\n");

  const batchIndex = await getBatchIndexForDay(batch.id, batch.created_at);
  const suffix = batchIndex ? `_b${String(batchIndex).padStart(2, "0")}` : "";
  const filename = `linkets_${safeLabel.replace(/\s+/g, "_")}${suffix}_${rows.length}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
