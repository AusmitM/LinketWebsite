import "server-only";

import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase-admin";
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

export async function getPersonalProLoyaltyStatusForUser(
  userId: string
): Promise<PersonalProLoyaltyStatus> {
  const base = buildDefaultPersonalProLoyaltyStatus();

  if (!isSupabaseAdminAvailable) {
    return base;
  }

  const { data, error } = await supabaseAdmin
    .from("subscription_billing_periods")
    .select("period_start,period_end")
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .eq("status", "paid")
    .order("period_start", { ascending: true })
    .returns<SubscriptionBillingPeriodRow[]>();

  if (error) {
    if (isMissingRelationError(error.message)) {
      return base;
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
  const earliestStartMs = rows
    .map((row) => parseIsoToMs(row.period_start))
    .filter((value): value is number => value !== null)
    .reduce<number | null>(
      (current, value) =>
        current === null ? value : Math.min(current, value),
      null
    );

  if (earliestStartMs === null) {
    return {
      ...base,
      source: "none",
    };
  }

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
      startedAt: new Date(earliestStartMs).toISOString(),
    };
  }

  const requiredPaidMs = base.requiredPaidDays * MS_PER_DAY;
  let totalPaidMs = 0;
  let eligibilityReachedAtMs: number | null = null;

  for (const interval of mergedIntervals) {
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

  const isActivePaidNow = rows.some((row) => {
    const startMs = parseIsoToMs(row.period_start);
    const endMs = parseIsoToMs(row.period_end);
    if (startMs === null || endMs === null) return false;
    return startMs <= nowMs && nowMs < endMs;
  });

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
