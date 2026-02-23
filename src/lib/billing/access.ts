import "server-only";

import type { ThemeName } from "@/lib/themes";
import {
  FREE_PLAN_ALLOWED_THEMES,
  FREE_PLAN_MAX_PUBLISHED_LINKS,
} from "@/lib/billing/feature-limits";
import { getBillingSummaryForUser } from "@/lib/billing/entitlements";
import type { BillingPlanKey } from "@/types/billing";

export type BillingAccess = {
  userId: string;
  activePlanKey: BillingPlanKey;
  hasPaidAccess: boolean;
  allowsAnalytics: boolean;
  maxPublishedLinks: number | null;
  allowedThemes: readonly ThemeName[] | null;
};

function buildFallbackFreeAccess(userId: string): BillingAccess {
  return {
    userId,
    activePlanKey: "free",
    hasPaidAccess: false,
    allowsAnalytics: false,
    maxPublishedLinks: FREE_PLAN_MAX_PUBLISHED_LINKS,
    allowedThemes: FREE_PLAN_ALLOWED_THEMES,
  };
}

export async function getBillingAccessForUser(userId: string, client?: any) {
  if (!userId) return buildFallbackFreeAccess(userId);

  try {
    const summary = await getBillingSummaryForUser(userId, client);
    if (summary.hasPaidAccess) {
      return {
        userId,
        activePlanKey: summary.activePlanKey,
        hasPaidAccess: true,
        allowsAnalytics: true,
        maxPublishedLinks: null,
        allowedThemes: null,
      } satisfies BillingAccess;
    }

    return {
      userId,
      activePlanKey: summary.activePlanKey,
      hasPaidAccess: false,
      allowsAnalytics: false,
      maxPublishedLinks: FREE_PLAN_MAX_PUBLISHED_LINKS,
      allowedThemes: FREE_PLAN_ALLOWED_THEMES,
    } satisfies BillingAccess;
  } catch {
    return buildFallbackFreeAccess(userId);
  }
}
