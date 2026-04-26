import "server-only";

import { normalizeClaimCodeInput } from "@/lib/linket-claim-code";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

export type LinketLookupRecord = {
  id: string;
  chip_uid: string;
  claim_code: string | null;
  public_token: string | null;
  status: string;
  last_claimed_at: string | null;
};

function dedupe(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

async function lookupByField(
  field: "id" | "claim_code" | "public_token" | "chip_uid",
  values: string[]
) {
  if (values.length === 0) return null;

  const { data, error } = await supabaseAdmin
    .from("hardware_tags")
    .select("id,chip_uid,claim_code,public_token,status,last_claimed_at")
    .limit(1)
    .in(field, values)
    .returns<LinketLookupRecord[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data?.[0] ?? null;
}

export async function findLinketByLookup(
  rawValue: string
): Promise<LinketLookupRecord | null> {
  if (!isSupabaseAdminAvailable) {
    throw new Error("Linkets service is not configured.");
  }

  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const claimCode = normalizeClaimCodeInput(trimmed);
  const rawCandidates = dedupe([trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()]);
  const claimCodeCandidates = dedupe([
    claimCode,
    claimCode.toUpperCase(),
    claimCode.toLowerCase(),
  ]);

  const lookups: Array<Promise<LinketLookupRecord | null>> = [];

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    lookups.push(lookupByField("id", [trimmed]));
  }

  lookups.push(lookupByField("claim_code", claimCodeCandidates));
  lookups.push(lookupByField("public_token", rawCandidates));
  lookups.push(lookupByField("chip_uid", rawCandidates));

  for (const lookup of lookups) {
    const match = await lookup;
    if (match) return match;
  }

  return null;
}
