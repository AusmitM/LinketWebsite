export type BillingPlanKey = "free" | "pro_monthly" | "pro_yearly" | "bundle_59";

export type CheckoutPlanKey = Exclude<BillingPlanKey, "free">;

export type BillingSource = "landing" | "dashboard";

export type CheckoutRequest = {
  planKey: CheckoutPlanKey;
  source: BillingSource;
};

export type CheckoutResponse = {
  url: string;
};

export type PortalResponse = {
  url: string;
};

export type BillingSubscriptionSnapshot = {
  id: string;
  status: string;
  priceId: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type BillingEntitlementSnapshot = {
  id: string;
  planKey: BillingPlanKey;
  sourceType: "subscription" | "bundle" | "linket_offer";
  sourceId: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  daysUntilExpiry: number | null;
  inAppPromptedAt: string | null;
  emailPromptedAt: string | null;
};

export type BillingSummary = {
  userId: string;
  activePlanKey: BillingPlanKey;
  activePlanName: string;
  hasPaidAccess: boolean;
  proDiscountEligibility: {
    eligible: boolean;
    requiredPaidDays: number;
    accumulatedPaidDays: number;
    remainingPaidDays: number;
  };
  subscription: BillingSubscriptionSnapshot | null;
  entitlement: BillingEntitlementSnapshot | null;
  renewalPrompt: {
    shouldShow: boolean;
    daysUntilExpiry: number | null;
    channel: "in_app_and_email";
  };
  availableCheckoutPlans: CheckoutPlanKey[];
};
