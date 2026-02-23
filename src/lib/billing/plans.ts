import type { BillingPlanKey, CheckoutPlanKey } from "@/types/billing";

export type BillingPlanDefinition = {
  key: BillingPlanKey;
  name: string;
  displayPrice: string;
  billingLabel: string;
  mode: "subscription" | "payment" | "none";
  audience: "individual" | "business";
  stripePriceEnv?: string;
};

export const BILLING_PLANS: Record<BillingPlanKey, BillingPlanDefinition> = {
  free: {
    key: "free",
    name: "Free Web-Only",
    displayPrice: "$0",
    billingLabel: "free + limited features",
    mode: "none",
    audience: "individual",
  },
  pro_monthly: {
    key: "pro_monthly",
    name: "Paid Web-Only (Pro Monthly)",
    displayPrice: "$7/mo",
    billingLabel: "billed monthly",
    mode: "subscription",
    audience: "individual",
    stripePriceEnv: "STRIPE_PRICE_PRO_MONTHLY",
  },
  pro_yearly: {
    key: "pro_yearly",
    name: "Paid Web-Only (Pro Yearly)",
    displayPrice: "$70/yr",
    billingLabel: "billed yearly",
    mode: "subscription",
    audience: "individual",
    stripePriceEnv: "STRIPE_PRICE_PRO_YEARLY",
  },
  bundle_59: {
    key: "bundle_59",
    name: "Web + Linket Bundle",
    displayPrice: "$59",
    billingLabel: "$59 one-time, includes 12 months of Pro",
    mode: "payment",
    audience: "individual",
    stripePriceEnv: "STRIPE_PRICE_BUNDLE_ONE_TIME",
  },
};

export const CHECKOUT_PLAN_KEYS: readonly CheckoutPlanKey[] = [
  "pro_monthly",
  "pro_yearly",
  "bundle_59",
] as const;

export const BUNDLE_ENTITLEMENT_MONTHS = 12;
export const BUNDLE_RENEWAL_REMINDER_WINDOW_DAYS = 30;
export const PRO_DISCOUNT_REQUIRED_PAID_DAYS = 365;

export const PRO_DISCOUNT_PRICING = {
  pro_monthly: {
    displayPrice: "$5/mo",
    billingLabel: "discounted monthly",
  },
  pro_yearly: {
    displayPrice: "$50/yr",
    billingLabel: "discounted yearly",
  },
} as const;

const CHECKOUT_PLAN_SET = new Set<CheckoutPlanKey>(CHECKOUT_PLAN_KEYS);
const BILLING_PLAN_SET = new Set<BillingPlanKey>(
  Object.keys(BILLING_PLANS) as BillingPlanKey[]
);

export function isCheckoutPlanKey(value: string): value is CheckoutPlanKey {
  return CHECKOUT_PLAN_SET.has(value as CheckoutPlanKey);
}

export function isBillingPlanKey(value: string): value is BillingPlanKey {
  return BILLING_PLAN_SET.has(value as BillingPlanKey);
}

export function getBillingPlanDefinition(
  planKey: BillingPlanKey
): BillingPlanDefinition {
  return BILLING_PLANS[planKey];
}

type StripePriceContext = {
  discountEligibleForPro?: boolean;
};

function getRequiredEnvValue(envKey: string) {
  const value = process.env[envKey]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${envKey}.`);
  }
  return value;
}

function resolveEnvForPrice(
  planKey: CheckoutPlanKey,
  context?: StripePriceContext
) {
  const discountEligible = Boolean(context?.discountEligibleForPro);

  switch (planKey) {
    case "bundle_59":
      return "STRIPE_PRICE_BUNDLE_ONE_TIME";
    case "pro_monthly":
      return discountEligible
        ? "STRIPE_PRICE_PRO_MONTHLY_DISCOUNTED"
        : "STRIPE_PRICE_PRO_MONTHLY";
    case "pro_yearly":
      return discountEligible
        ? "STRIPE_PRICE_PRO_YEARLY_DISCOUNTED"
        : "STRIPE_PRICE_PRO_YEARLY";
    default: {
      const exhaustiveCheck: never = planKey;
      throw new Error(`Unsupported plan key: ${String(exhaustiveCheck)}`);
    }
  }
}

export function getStripePriceId(
  planKey: CheckoutPlanKey,
  context?: StripePriceContext
): string {
  const envKey = resolveEnvForPrice(planKey, context);
  return getRequiredEnvValue(envKey);
}

export function getPlanKeyFromStripePriceId(priceId: string): BillingPlanKey | null {
  for (const [envKey, mappedPlanKey] of Object.entries({
    STRIPE_PRICE_PRO_MONTHLY: "pro_monthly",
    STRIPE_PRICE_PRO_MONTHLY_DISCOUNTED: "pro_monthly",
    STRIPE_PRICE_PRO_YEARLY: "pro_yearly",
    STRIPE_PRICE_PRO_YEARLY_DISCOUNTED: "pro_yearly",
    STRIPE_PRICE_BUNDLE_ONE_TIME: "bundle_59",
  } as const)) {
    const envValue = process.env[envKey]?.trim();
    if (envValue && envValue === priceId) {
      return mappedPlanKey;
    }
  }
  return null;
}

export function getStripePriceIdSafe(planKey: CheckoutPlanKey): string | null {
  const envKey = resolveEnvForPrice(planKey);
  if (!envKey) return null;
  const value = process.env[envKey];
  return value?.trim() ? value.trim() : null;
}

export function getPlanDisplay(
  planKey: BillingPlanKey,
  proDiscountEligible = false
) {
  if (planKey === "pro_monthly" || planKey === "pro_yearly") {
    if (proDiscountEligible) {
      return {
        displayPrice: PRO_DISCOUNT_PRICING[planKey].displayPrice,
        billingLabel: PRO_DISCOUNT_PRICING[planKey].billingLabel,
      };
    }
  }
  return {
    displayPrice: BILLING_PLANS[planKey].displayPrice,
    billingLabel: BILLING_PLANS[planKey].billingLabel,
  };
}
