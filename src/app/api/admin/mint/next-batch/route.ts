import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRouteAccess } from "@/lib/api-authorization";
import { validateSearchParams } from "@/lib/request-validation";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

const LABEL_MAX = 64;
const nextBatchQuerySchema = z.object({
  label: z.string().trim().max(LABEL_MAX).optional().default(""),
});

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

  const access = await requireRouteAccess("GET /api/admin/mint/next-batch");
  if (access instanceof NextResponse) {
    return access;
  }

  const parsedQuery = validateSearchParams(req.nextUrl.searchParams, nextBatchQuerySchema);
  if (!parsedQuery.ok) {
    return parsedQuery.response;
  }

  const rawLabel = sanitizeLabel(parsedQuery.data.label);
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
