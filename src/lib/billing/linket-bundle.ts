import "server-only";

import { getPublicPricingSnapshot } from "@/lib/billing/pricing";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ClaimEventRow = {
  occurred_at: string;
};

export type LinketBundleComplimentaryWindow = {
  eligible: boolean;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  daysRemaining: number | null;
  includedMonths: number;
  source: "linket_claim" | "none" | "unavailable";
};

function isMissingRelationError(message: string) {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("does not exist") ||
    lowered.includes("relation") ||
    lowered.includes("schema cache")
  );
}

function addUtcMonths(isoValue: string, months: number) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
}

function toMs(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

type ClaimLookupResult = {
  value: string | null;
  source: "linket_claim" | "unavailable";
};

async function fetchEarliestClaimAtByMetadataField(
  userId: string,
  metadataField: "entitlement_user_id" | "user_id"
): Promise<ClaimLookupResult> {
  if (isSupabaseAdminAvailable) {
    const { data, error } = await supabaseAdmin
      .from("tag_events")
      .select("occurred_at")
      .eq("event_type", "claim")
      .filter(`metadata->>${metadataField}`, "eq", userId)
      .order("occurred_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .returns<ClaimEventRow | null>();

    if (error) {
      if (isMissingRelationError(error.message)) {
        return { value: null, source: "unavailable" };
      }
      throw new Error(error.message);
    }

    return { value: data?.occurred_at ?? null, source: "linket_claim" };
  }

  const supabase = await createServerSupabaseReadonly();
  const { data, error } = await supabase
    .from("tag_events")
    .select("occurred_at")
    .eq("event_type", "claim")
    .filter(`metadata->>${metadataField}`, "eq", userId)
    .order("occurred_at", { ascending: true })
    .limit(1)
    .maybeSingle()
    .returns<ClaimEventRow | null>();

  if (error) {
    if (isMissingRelationError(error.message)) {
      return { value: null, source: "unavailable" };
    }
    throw new Error(error.message);
  }

  return { value: data?.occurred_at ?? null, source: "linket_claim" };
}

function pickEarliestIsoTimestamp(values: Array<string | null>) {
  let earliest: string | null = null;
  let earliestMs: number | null = null;

  for (const value of values) {
    if (!value) continue;
    const ms = toMs(value);
    if (ms === null) continue;
    if (earliestMs === null || ms < earliestMs) {
      earliest = value;
      earliestMs = ms;
    }
  }

  return earliest;
}

async function fetchEarliestClaimAt(userId: string) {
  const [entitlementClaim, legacyClaim] = await Promise.all([
    fetchEarliestClaimAtByMetadataField(userId, "entitlement_user_id"),
    fetchEarliestClaimAtByMetadataField(userId, "user_id"),
  ]);

  const value = pickEarliestIsoTimestamp([
    entitlementClaim.value,
    legacyClaim.value,
  ]);

  const source: "linket_claim" | "unavailable" =
    entitlementClaim.source === "unavailable" &&
    legacyClaim.source === "unavailable"
      ? "unavailable"
      : "linket_claim";

  return { value, source };
}

export async function getLinketBundleComplimentaryWindowForUser(
  userId: string
): Promise<LinketBundleComplimentaryWindow> {
  const includesProMonths =
    getPublicPricingSnapshot().individual.webPlusLinketBundle.includesProMonths;
  const defaultResponse: LinketBundleComplimentaryWindow = {
    eligible: false,
    startsAt: null,
    endsAt: null,
    active: false,
    daysRemaining: null,
    includedMonths: includesProMonths,
    source: "none",
  };

  const claim = await fetchEarliestClaimAt(userId);
  if (!claim.value) {
    return {
      ...defaultResponse,
      source: claim.source === "unavailable" ? "unavailable" : "none",
    };
  }

  const endsAt = addUtcMonths(claim.value, includesProMonths);
  if (!endsAt) {
    return {
      ...defaultResponse,
      source: "linket_claim",
    };
  }

  const nowMs = Date.now();
  const endsAtMs = toMs(endsAt);
  const active = endsAtMs !== null && nowMs < endsAtMs;
  const daysRemaining =
    active && endsAtMs !== null
      ? Math.max(1, Math.ceil((endsAtMs - nowMs) / MS_PER_DAY))
      : 0;

  return {
    eligible: true,
    startsAt: claim.value,
    endsAt,
    active,
    daysRemaining,
    includedMonths: includesProMonths,
    source: "linket_claim",
  };
}
