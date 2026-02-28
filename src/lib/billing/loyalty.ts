import "server-only";

import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase-admin";
import { getLinketBundleComplimentaryWindowForUser } from "@/lib/billing/linket-bundle";
import {
  buildDefaultPersonalProLoyaltyStatus,
  type PersonalProLoyaltyStatus,
} from "@/lib/billing/pricing";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isMissingRelationError(message: string) {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("does not exist") ||
    lowered.includes("relation") ||
    lowered.includes("schema cache")
  );
}

type SubscriptionBillingPeriodRow = {
  period_start: string | null;
  period_end: string | null;
  metadata: Record<string, unknown> | null;
};

type MergedPeriod = {
  startMs: number;
  endMs: number;
};

function parseIsoToMs(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function parseIsoToMsFromUnknown(value: unknown) {
  return typeof value === "string" ? parseIsoToMs(value) : null;
}

function parseBooleanFromUnknown(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function mergeIntervals(intervals: MergedPeriod[]): MergedPeriod[] {
  if (intervals.length <= 1) return intervals;
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const merged: MergedPeriod[] = [sorted[0]];
  for (const interval of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (interval.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, interval.endMs);
      continue;
    }
    merged.push(interval);
  }
  return merged;
}

function buildIntervalFromBounds(startMs: number, endMs: number): MergedPeriod | null {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  if (endMs <= startMs) return null;
  return { startMs, endMs };
}

function subtractWindowFromInterval(
  interval: MergedPeriod,
  window: MergedPeriod
): MergedPeriod[] {
  if (interval.endMs <= window.startMs || interval.startMs >= window.endMs) {
    return [interval];
  }

  if (interval.startMs >= window.startMs && interval.endMs <= window.endMs) {
    return [];
  }

  const result: MergedPeriod[] = [];
  if (interval.startMs < window.startMs) {
    const left = buildIntervalFromBounds(interval.startMs, window.startMs);
    if (left) result.push(left);
  }
  if (interval.endMs > window.endMs) {
    const right = buildIntervalFromBounds(window.endMs, interval.endMs);
    if (right) result.push(right);
  }
  return result;
}

function subtractWindowFromIntervals(
  intervals: MergedPeriod[],
  window: MergedPeriod | null
) {
  if (!window) return intervals;
  return mergeIntervals(
    intervals.flatMap((interval) => subtractWindowFromInterval(interval, window))
  );
}

function readComplimentaryWindowFromMetadata(
  metadata: Record<string, unknown> | null
): MergedPeriod | null {
  if (!metadata) return null;
  const active = parseBooleanFromUnknown(metadata.complimentary_window_active);
  if (active !== true) return null;

  const startMs = parseIsoToMsFromUnknown(
    metadata.complimentary_window_starts_at
  );
  const endMs = parseIsoToMsFromUnknown(metadata.complimentary_window_ends_at);
  if (startMs === null || endMs === null) return null;
  return buildIntervalFromBounds(startMs, endMs);
}

export async function getPersonalProLoyaltyStatusForUser(
  userId: string
): Promise<PersonalProLoyaltyStatus | null> {
  const base = buildDefaultPersonalProLoyaltyStatus();

  if (!isSupabaseAdminAvailable) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("subscription_billing_periods")
    .select("period_start,period_end,metadata")
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .eq("status", "paid")
    .order("period_start", { ascending: true })
    .returns<SubscriptionBillingPeriodRow[]>();

  if (error) {
    if (isMissingRelationError(error.message)) {
      return null;
    }
    throw new Error(`Unable to resolve loyalty eligibility: ${error.message}`);
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return {
      ...base,
      source: "none",
    };
  }

  const nowMs = Date.now();
  const mergedIntervals = mergeIntervals(
    rows
      .map((row) => {
        const rawStartMs = parseIsoToMs(row.period_start);
        const rawEndMs = parseIsoToMs(row.period_end);
        if (rawStartMs === null || rawEndMs === null) return null;
        if (rawEndMs <= rawStartMs) return null;
        const startMs = rawStartMs;
        const endMs = Math.min(rawEndMs, nowMs);
        if (endMs <= startMs) return null;
        return { startMs, endMs } satisfies MergedPeriod;
      })
      .filter((value): value is MergedPeriod => value !== null)
  );

  if (mergedIntervals.length === 0) {
    return {
      ...base,
      source: "none",
    };
  }

  const complimentaryWindow = await getLinketBundleComplimentaryWindowForUser(userId);
  const complimentaryWindowInterval = buildIntervalFromBounds(
    parseIsoToMs(complimentaryWindow.startsAt) ?? Number.NaN,
    parseIsoToMs(complimentaryWindow.endsAt) ?? Number.NaN
  );
  const metadataComplimentaryWindows = mergeIntervals(
    rows
      .map((row) => readComplimentaryWindowFromMetadata(row.metadata))
      .filter((value): value is MergedPeriod => value !== null)
  );

  let effectiveIntervals = subtractWindowFromIntervals(
    mergedIntervals,
    complimentaryWindowInterval
  );
  for (const window of metadataComplimentaryWindows) {
    effectiveIntervals = subtractWindowFromIntervals(effectiveIntervals, window);
  }

  if (effectiveIntervals.length === 0) {
    return {
      ...base,
      source: "none",
    };
  }

  const earliestStartMs = effectiveIntervals.reduce<number>(
    (current, interval) => Math.min(current, interval.startMs),
    effectiveIntervals[0].startMs
  );

  const requiredPaidMs = base.requiredPaidDays * MS_PER_DAY;
  let totalPaidMs = 0;
  let eligibilityReachedAtMs: number | null = null;

  for (const interval of effectiveIntervals) {
    const intervalMs = interval.endMs - interval.startMs;
    if (
      eligibilityReachedAtMs === null &&
      totalPaidMs + intervalMs >= requiredPaidMs
    ) {
      const remainderMs = requiredPaidMs - totalPaidMs;
      eligibilityReachedAtMs = interval.startMs + remainderMs;
    }
    totalPaidMs += intervalMs;
  }

  const totalPaidDays = Math.floor(totalPaidMs / MS_PER_DAY);
  const eligible = totalPaidMs >= requiredPaidMs;

  const isActivePaidNow = effectiveIntervals.some(
    (interval) => interval.startMs <= nowMs && nowMs < interval.endMs
  );

  let eligibleOn: string | null = null;
  let daysUntilEligible: number | null = null;

  if (eligible) {
    eligibleOn = new Date(eligibilityReachedAtMs ?? nowMs).toISOString();
    daysUntilEligible = 0;
  } else if (isActivePaidNow) {
    const remainingMs = requiredPaidMs - totalPaidMs;
    const projectedEligibilityMs = nowMs + remainingMs;
    eligibleOn = new Date(projectedEligibilityMs).toISOString();
    daysUntilEligible = Math.max(1, Math.ceil(remainingMs / MS_PER_DAY));
  }

  return {
    ...base,
    eligible,
    startedAt: new Date(earliestStartMs).toISOString(),
    eligibleOn,
    daysUntilEligible,
    source: "stripe_subscription_periods",
    totalPaidDays,
    currentRate: eligible ? { ...base.loyaltyRate } : { ...base.initialRate },
  };
}
