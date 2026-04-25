import { NextResponse } from "next/server";
import { requireRouteAccess } from "@/lib/api-authorization";
import { formatClaimCodeDisplay } from "@/lib/linket-claim-code";
import { uuidParamSchema } from "@/lib/request-validation";
import { sanitizeAttachmentFilename } from "@/lib/security";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import { getConfiguredSiteOrigin } from "@/lib/site-url";

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

function getSiteBase() {
  return getConfiguredSiteOrigin().replace(/\/$/, "");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json(
      { error: "Admin minting is not configured." },
      { status: 500 }
    );
  }

  const access = await requireRouteAccess("GET /api/admin/mint/batch/[batchId]");
  if (access instanceof NextResponse) {
    return access;
  }

  const { batchId: rawBatchId } = await params;
  const parsedBatchId = uuidParamSchema.safeParse(rawBatchId?.trim());
  if (!parsedBatchId.success) {
    return NextResponse.json({ error: "Valid batch id is required." }, { status: 400 });
  }
  const batchId = parsedBatchId.data;

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
    .select("id, public_token, claim_code, batch_id, created_at, status")
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
    "claimed",
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
        claim_code_display: formatClaimCodeDisplay(row.claim_code),
        batch_id: row.batch_id,
        batch_label: safeLabel,
        claimed: row.status === "claimed" ? "yes" : "no",
      };
      return columns.map((key) => csvEscape(record[key as keyof typeof record])).join(",");
    }),
  ].join("\n");

  const batchIndex = await getBatchIndexForDay(batch.id, batch.created_at);
  const suffix = batchIndex ? `_b${String(batchIndex).padStart(2, "0")}` : "";
  const filename = sanitizeAttachmentFilename(
    `linkets_${safeLabel.replace(/\s+/g, "_")}${suffix}_${rows.length}.csv`,
    "linkets_batch.csv"
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
