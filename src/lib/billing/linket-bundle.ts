import "server-only";

import { getPublicPricingSnapshot } from "@/lib/billing/pricing";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ClaimEventRow = {
  occurred_at: string;
};

type CoveredPaidPeriodRow = {
  period_end: string | null;
};

export type LinketBundleComplimentaryWindow = {
  eligible: boolean;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  startsInDays: number | null;
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

async function fetchDeferredComplimentaryStartAt(
  userId: string,
  claimAt: string
) {
  const execute = async (
    db: typeof supabaseAdmin | Awaited<ReturnType<typeof createServerSupabaseReadonly>>
  ) => {
    const { data, error } = await db
      .from("subscription_billing_periods")
      .select("period_end")
      .eq("user_id", userId)
      .eq("provider", "stripe")
      .eq("status", "paid")
      .lte("period_start", claimAt)
      .gt("period_end", claimAt)
      .order("period_end", { ascending: true })
      .limit(1)
      .maybeSingle()
      .returns<CoveredPaidPeriodRow | null>();

    if (error) throw error;
    return data?.period_end ?? null;
  };

  if (isSupabaseAdminAvailable) {
    try {
      return await execute(supabaseAdmin);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string" &&
        isMissingRelationError(error.message)
      ) {
        return null;
      }
      throw error;
    }
  }

  const supabase = await createServerSupabaseReadonly();
  try {
    return await execute(supabase);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string" &&
      isMissingRelationError(error.message)
    ) {
      return null;
    }
    throw error;
  }
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
    startsInDays: null,
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

  const deferredStartAt = await fetchDeferredComplimentaryStartAt(
    userId,
    claim.value
  );
  const startsAt = deferredStartAt ?? claim.value;
  const endsAt = addUtcMonths(startsAt, includesProMonths);
  if (!endsAt) {
    return {
      ...defaultResponse,
      source: "linket_claim",
    };
  }

  const nowMs = Date.now();
  const startsAtMs = toMs(startsAt);
  const endsAtMs = toMs(endsAt);
  const active =
    startsAtMs !== null &&
    endsAtMs !== null &&
    nowMs >= startsAtMs &&
    nowMs < endsAtMs;
  const startsInDays =
    startsAtMs !== null && nowMs < startsAtMs
      ? Math.max(1, Math.ceil((startsAtMs - nowMs) / MS_PER_DAY))
      : null;
  const daysRemaining =
    active && endsAtMs !== null
      ? Math.max(1, Math.ceil((endsAtMs - nowMs) / MS_PER_DAY))
      : 0;

  return {
    eligible: true,
    startsAt,
    endsAt,
    active,
    startsInDays,
    daysRemaining,
    includedMonths: includesProMonths,
    source: "linket_claim",
  };
}
