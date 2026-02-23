import "server-only";

import type Stripe from "stripe";

import {
  BUNDLE_ENTITLEMENT_MONTHS,
  BUNDLE_RENEWAL_REMINDER_WINDOW_DAYS,
  CHECKOUT_PLAN_KEYS,
  getBillingPlanDefinition,
  getPlanKeyFromStripePriceId,
  PRO_DISCOUNT_REQUIRED_PAID_DAYS,
} from "@/lib/billing/plans";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import type {
  BillingPlanKey,
  BillingEntitlementSnapshot,
  BillingSummary,
  BillingSubscriptionSnapshot,
  CheckoutPlanKey,
} from "@/types/billing";

type BillingSubscriptionRow = {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  paid_days: number | null;
};

type BillingEntitlementRow = {
  id: string;
  user_id: string;
  plan_key: BillingPlanKey;
  source_type: "subscription" | "bundle" | "linket_offer";
  source_id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  in_app_prompted_at: string | null;
  email_prompted_at: string | null;
};

type BillingOrderRow = {
  id: string;
  user_id: string;
  stripe_checkout_session_id: string;
  stripe_payment_intent_id: string | null;
  status: string;
};

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42703") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
}

function toIsoFromUnix(timestamp: number | null | undefined) {
  if (!timestamp || !Number.isFinite(timestamp)) return null;
  return new Date(timestamp * 1000).toISOString();
}

function inferPaidDaysFromInvoice(invoice: Stripe.Invoice) {
  const directStart =
    typeof invoice.period_start === "number" ? invoice.period_start : null;
  const directEnd =
    typeof invoice.period_end === "number" ? invoice.period_end : null;

  if (directStart !== null && directEnd !== null && directEnd > directStart) {
    const days = Math.ceil((directEnd - directStart) / (24 * 60 * 60));
    return Math.max(1, days);
  }

  const fallbackLine =
    invoice.lines?.data?.find((line) => {
      const start = line.period?.start;
      const end = line.period?.end;
      return (
        typeof start === "number" && typeof end === "number" && end > start
      );
    }) ?? null;

  if (fallbackLine?.period?.start && fallbackLine?.period?.end) {
    const days = Math.ceil(
      (fallbackLine.period.end - fallbackLine.period.start) / (24 * 60 * 60)
    );
    return Math.max(1, days);
  }

  return 30;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const rawInvoice = invoice as unknown as {
    subscription?: unknown;
    parent?: {
      subscription_details?: {
        subscription?: unknown;
      } | null;
    } | null;
  };

  if (typeof rawInvoice.subscription === "string") {
    return rawInvoice.subscription;
  }

  const nestedSubscriptionId =
    rawInvoice.parent?.subscription_details?.subscription;
  return typeof nestedSubscriptionId === "string" ? nestedSubscriptionId : null;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date.getTime());
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
}

function getSubscriptionPeriodRange(subscription: Stripe.Subscription) {
  const rawSubscription = subscription as unknown as {
    current_period_start?: unknown;
    current_period_end?: unknown;
    items?: {
      data?: Array<{
        current_period_start?: unknown;
        current_period_end?: unknown;
      }>;
    };
  };

  const directStart =
    typeof rawSubscription.current_period_start === "number"
      ? rawSubscription.current_period_start
      : null;
  const directEnd =
    typeof rawSubscription.current_period_end === "number"
      ? rawSubscription.current_period_end
      : null;
  if (directStart !== null || directEnd !== null) {
    return { start: directStart, end: directEnd };
  }

  const item = rawSubscription.items?.data?.[0];
  const itemStart =
    typeof item?.current_period_start === "number"
      ? item.current_period_start
      : null;
  const itemEnd =
    typeof item?.current_period_end === "number"
      ? item.current_period_end
      : null;
  return { start: itemStart, end: itemEnd };
}

function getSessionCustomerId(
  session: Stripe.Checkout.Session
): string | null {
  if (!session.customer) return null;
  return typeof session.customer === "string"
    ? session.customer
    : session.customer.id;
}

function getSessionShippingDetails(session: Stripe.Checkout.Session) {
  const rawSession = session as unknown as {
    shipping_details?: {
      name?: unknown;
      phone?: unknown;
      address?: unknown;
    } | null;
    collected_information?: {
      shipping_details?: {
        name?: unknown;
        address?: unknown;
      } | null;
    } | null;
    customer_details?: {
      phone?: unknown;
    } | null;
  };

  const legacyShipping = rawSession.shipping_details;
  const collectedShipping = rawSession.collected_information?.shipping_details;
  const nameCandidate = legacyShipping?.name ?? collectedShipping?.name;
  const phoneCandidate = legacyShipping?.phone ?? rawSession.customer_details?.phone;
  const addressCandidate = legacyShipping?.address ?? collectedShipping?.address;

  return {
    name: typeof nameCandidate === "string" ? nameCandidate : null,
    phone: typeof phoneCandidate === "string" ? phoneCandidate : null,
    address:
      typeof addressCandidate === "object" && addressCandidate !== null
        ? (addressCandidate as Stripe.Address)
        : null,
  };
}

async function getUserIdFromStripeCustomerId(stripeCustomerId: string) {
  if (!isSupabaseAdminAvailable) return null;
  const { data, error } = await supabaseAdmin
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }

  return data?.user_id ?? null;
}

async function upsertBillingCustomer(params: {
  userId: string;
  stripeCustomerId: string;
  email: string | null;
}) {
  if (!isSupabaseAdminAvailable) return;
  const { error } = await supabaseAdmin.from("billing_customers").upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId,
      email: params.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }
}

function hasActiveStatus(status: string) {
  return ["trialing", "active", "past_due", "unpaid"].includes(status);
}

function asCheckoutPlanKey(planKey: BillingPlanKey | null): CheckoutPlanKey | null {
  if (!planKey) return null;
  return CHECKOUT_PLAN_KEYS.includes(planKey as CheckoutPlanKey)
    ? (planKey as CheckoutPlanKey)
    : null;
}

async function upsertEntitlement(row: {
  user_id: string;
  plan_key: BillingPlanKey;
  source_type: "subscription" | "bundle" | "linket_offer";
  source_id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
}) {
  if (!isSupabaseAdminAvailable) return;
  const { error } = await supabaseAdmin.from("billing_entitlements").upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source_type,source_id" }
  );
  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }
}

export async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription) {
  if (!isSupabaseAdminAvailable) return;

  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const metadataUserId =
    typeof subscription.metadata?.userId === "string"
      ? subscription.metadata.userId
      : null;
  const userId = metadataUserId || (await getUserIdFromStripeCustomerId(stripeCustomerId));
  if (!userId) return;

  await upsertBillingCustomer({
    userId,
    stripeCustomerId,
    email: null,
  });

  const firstItem = subscription.items.data[0];
  const firstPriceId = firstItem?.price?.id ?? "";
  const planKey = getPlanKeyFromStripePriceId(firstPriceId);
  const period = getSubscriptionPeriodRange(subscription);
  const startsAt = toIsoFromUnix(period.start) ?? new Date().toISOString();
  const endsAt = toIsoFromUnix(period.end);
  const entitlementStatus = hasActiveStatus(subscription.status) ? "active" : "inactive";

  const { error: subscriptionError } = await supabaseAdmin
    .from("billing_subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: stripeCustomerId,
        price_id: firstPriceId,
        status: subscription.status,
        current_period_start: startsAt,
        current_period_end: endsAt,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" }
    );

  if (subscriptionError && !isMissingRelationError(subscriptionError)) {
    throw new Error(subscriptionError.message);
  }

  const checkoutPlanKey = asCheckoutPlanKey(planKey);
  if (!checkoutPlanKey) return;

  await upsertEntitlement({
    user_id: userId,
    plan_key: checkoutPlanKey,
    source_type: "subscription",
    source_id: subscription.id,
    status: entitlementStatus,
    starts_at: startsAt,
    ends_at: endsAt,
  });
}

export async function recordBundleCheckoutSession(
  session: Stripe.Checkout.Session
) {
  if (!isSupabaseAdminAvailable) return;
  const planKey =
    typeof session.metadata?.planKey === "string" ? session.metadata.planKey : null;
  if (session.mode !== "payment" || planKey !== "bundle_59") {
    return;
  }

  const metadataUserId =
    typeof session.metadata?.userId === "string" ? session.metadata.userId : null;
  const userId = metadataUserId || session.client_reference_id;
  if (!userId) return;

  const stripeCustomerId = getSessionCustomerId(session);
  if (stripeCustomerId) {
    await upsertBillingCustomer({
      userId,
      stripeCustomerId,
      email: session.customer_details?.email ?? null,
    });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;
  const shippingDetails = getSessionShippingDetails(session);
  const createdAt = toIsoFromUnix(session.created) ?? new Date().toISOString();

  const { error: orderError } = await supabaseAdmin
    .from("billing_orders")
    .upsert(
      {
        user_id: userId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        status: session.payment_status === "paid" ? "paid" : "open",
        product_key: "bundle_59",
        amount_total: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        shipping_name: shippingDetails.name ?? session.customer_details?.name ?? null,
        shipping_phone: shippingDetails.phone ?? session.customer_details?.phone ?? null,
        shipping_address: shippingDetails.address,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_checkout_session_id" }
    );

  if (orderError && !isMissingRelationError(orderError)) {
    throw new Error(orderError.message);
  }

  if (session.payment_status !== "paid") return;

  const startsAtDate = new Date(createdAt);
  const endsAtDate = addMonths(startsAtDate, BUNDLE_ENTITLEMENT_MONTHS);

  await upsertEntitlement({
    user_id: userId,
    plan_key: "bundle_59",
    source_type: "bundle",
    source_id: session.id,
    status: "active",
    starts_at: startsAtDate.toISOString(),
    ends_at: endsAtDate.toISOString(),
  });
}

export async function markBundleCheckoutExpired(sessionId: string) {
  if (!isSupabaseAdminAvailable) return;
  const { error } = await supabaseAdmin
    .from("billing_orders")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_checkout_session_id", sessionId);
  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }
}

export async function grantLinketProOfferEntitlement(params: {
  userId: string;
  tagId: string;
  startsAt?: string;
}) {
  if (!isSupabaseAdminAvailable) return null;
  const startsAtDate = params.startsAt
    ? new Date(params.startsAt)
    : new Date();
  const validStartsAt = Number.isNaN(startsAtDate.getTime())
    ? new Date()
    : startsAtDate;
  const endsAtDate = addMonths(validStartsAt, 12);

  await upsertEntitlement({
    user_id: params.userId,
    plan_key: "pro_yearly",
    source_type: "linket_offer",
    source_id: params.tagId,
    status: "active",
    starts_at: validStartsAt.toISOString(),
    ends_at: endsAtDate.toISOString(),
  });

  return {
    startsAt: validStartsAt.toISOString(),
    endsAt: endsAtDate.toISOString(),
  };
}

export async function markInvoicePaid(invoice: Stripe.Invoice) {
  if (!isSupabaseAdminAvailable) return;
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const paidDaysToAdd = inferPaidDaysFromInvoice(invoice);

  const { data: subscriptionRow, error: lookupError } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("id,paid_days")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (lookupError && !isMissingRelationError(lookupError) && !isMissingColumnError(lookupError)) {
    throw new Error(lookupError.message);
  }
  if (!subscriptionRow && !isMissingColumnError(lookupError)) return;

  if (isMissingColumnError(lookupError)) {
    const { error: fallbackStatusError } = await supabaseAdmin
      .from("billing_subscriptions")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subscriptionId);
    if (
      fallbackStatusError &&
      !isMissingRelationError(fallbackStatusError)
    ) {
      throw new Error(fallbackStatusError.message);
    }
    return;
  }

  if (!subscriptionRow) return;

  const currentPaidDays =
    typeof subscriptionRow.paid_days === "number" ? subscriptionRow.paid_days : 0;

  const { error } = await supabaseAdmin
    .from("billing_subscriptions")
    .update({
      status: "active",
      paid_days: currentPaidDays + paidDaysToAdd,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);
  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }
}

export async function markInvoicePaymentFailed(subscriptionId: string) {
  if (!isSupabaseAdminAvailable) return;
  const { error } = await supabaseAdmin
    .from("billing_subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);
  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }
}

export async function handleChargeRefunded(paymentIntentId: string) {
  if (!isSupabaseAdminAvailable) return;
  const { data: orderRow, error: lookupError } = await supabaseAdmin
    .from("billing_orders")
    .select("id,user_id,stripe_checkout_session_id,stripe_payment_intent_id,status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (lookupError && !isMissingRelationError(lookupError)) {
    throw new Error(lookupError.message);
  }
  if (!orderRow) return;

  const order = orderRow as BillingOrderRow;

  const { error: orderError } = await supabaseAdmin
    .from("billing_orders")
    .update({
      status: "refunded",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);
  if (orderError && !isMissingRelationError(orderError)) {
    throw new Error(orderError.message);
  }

  const { error: entitlementError } = await supabaseAdmin
    .from("billing_entitlements")
    .update({
      status: "inactive",
      ends_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("source_type", "bundle")
    .eq("source_id", order.stripe_checkout_session_id);
  if (entitlementError && !isMissingRelationError(entitlementError)) {
    throw new Error(entitlementError.message);
  }
}

export async function createWebhookEventRecord(event: Stripe.Event) {
  if (!isSupabaseAdminAvailable) {
    throw new Error("Supabase admin client is required for webhook processing.");
  }
  const { error } = await supabaseAdmin.from("billing_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event,
  });

  if (!error) return { duplicate: false };
  if (error.code === "23505") return { duplicate: true };
  if (isMissingRelationError(error)) return { duplicate: false };
  throw new Error(error.message);
}

export async function markWebhookEventProcessed(eventId: string) {
  if (!isSupabaseAdminAvailable) return;
  await supabaseAdmin
    .from("billing_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq("stripe_event_id", eventId);
}

export async function markWebhookEventFailed(eventId: string, message: string) {
  if (!isSupabaseAdminAvailable) return;
  await supabaseAdmin
    .from("billing_webhook_events")
    .update({
      error: message.slice(0, 1000),
      processed_at: null,
    })
    .eq("stripe_event_id", eventId);
}

function daysUntil(dateIso: string | null) {
  if (!dateIso) return null;
  const delta = Date.parse(dateIso) - Date.now();
  if (!Number.isFinite(delta)) return null;
  return Math.ceil(delta / (24 * 60 * 60 * 1000));
}

function calculateProDiscountEligibility(subscriptions: BillingSubscriptionRow[]) {
  const accumulatedPaidDays = subscriptions.reduce((total, row) => {
    const paidDays = typeof row.paid_days === "number" ? row.paid_days : 0;
    return total + Math.max(0, paidDays);
  }, 0);
  const remainingPaidDays = Math.max(
    0,
    PRO_DISCOUNT_REQUIRED_PAID_DAYS - accumulatedPaidDays
  );
  return {
    eligible: remainingPaidDays === 0,
    requiredPaidDays: PRO_DISCOUNT_REQUIRED_PAID_DAYS,
    accumulatedPaidDays,
    remainingPaidDays,
  };
}

async function fetchSubscriptionsForUser(db: any, userId: string) {
  const subscriptionQuery = await db
    .from("billing_subscriptions")
    .select(
      "id,user_id,stripe_subscription_id,stripe_customer_id,price_id,status,current_period_start,current_period_end,cancel_at_period_end,paid_days"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (subscriptionQuery.error && isMissingColumnError(subscriptionQuery.error)) {
    const fallbackQuery = await db
      .from("billing_subscriptions")
      .select(
        "id,user_id,stripe_subscription_id,stripe_customer_id,price_id,status,current_period_start,current_period_end,cancel_at_period_end"
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (fallbackQuery.error && !isMissingRelationError(fallbackQuery.error)) {
      throw new Error(
        fallbackQuery.error.message || "Unable to load subscriptions."
      );
    }
    return ((fallbackQuery.data ?? []) as Omit<BillingSubscriptionRow, "paid_days">[]).map(
      (row) => ({ ...row, paid_days: 0 })
    );
  }

  if (subscriptionQuery.error && !isMissingRelationError(subscriptionQuery.error)) {
    throw new Error(
      subscriptionQuery.error.message || "Unable to load subscriptions."
    );
  }

  return (subscriptionQuery.data ?? []) as BillingSubscriptionRow[];
}

function isEntitlementCurrentlyActive(row: BillingEntitlementRow) {
  if (row.status !== "active") return false;
  if (!row.ends_at) return true;
  return Date.parse(row.ends_at) >= Date.now();
}

function sortEntitlements(rows: BillingEntitlementRow[]) {
  const priority: Record<BillingPlanKey, number> = {
    pro_yearly: 4,
    pro_monthly: 3,
    bundle_59: 2,
    free: 1,
  };
  return [...rows].sort((a, b) => {
    const byActive = Number(isEntitlementCurrentlyActive(b)) - Number(isEntitlementCurrentlyActive(a));
    if (byActive !== 0) return byActive;
    const byPriority = (priority[b.plan_key] ?? 0) - (priority[a.plan_key] ?? 0);
    if (byPriority !== 0) return byPriority;
    return Date.parse(b.starts_at) - Date.parse(a.starts_at);
  });
}

function toSubscriptionSnapshot(row: BillingSubscriptionRow | null): BillingSubscriptionSnapshot | null {
  if (!row) return null;
  return {
    id: row.stripe_subscription_id,
    status: row.status,
    priceId: row.price_id,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

function toEntitlementSnapshot(row: BillingEntitlementRow | null): BillingEntitlementSnapshot | null {
  if (!row) return null;
  return {
    id: row.id,
    planKey: row.plan_key,
    sourceType: row.source_type,
    sourceId: row.source_id,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    daysUntilExpiry: daysUntil(row.ends_at),
    inAppPromptedAt: row.in_app_prompted_at,
    emailPromptedAt: row.email_prompted_at,
  };
}

export async function markInAppPromptShown(entitlementId: string) {
  if (!isSupabaseAdminAvailable) return;
  const { error } = await supabaseAdmin
    .from("billing_entitlements")
    .update({
      in_app_prompted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", entitlementId)
    .is("in_app_prompted_at", null);
  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }
}

export async function getBillingSummaryForUser(
  userId: string,
  client?: any
): Promise<BillingSummary> {
  const db = client ?? supabaseAdmin;

  const entitlementQuery = await db
    .from("billing_entitlements")
    .select(
      "id,user_id,plan_key,source_type,source_id,status,starts_at,ends_at,in_app_prompted_at,email_prompted_at"
    )
    .eq("user_id", userId)
    .order("starts_at", { ascending: false })
    .limit(20);

  if (entitlementQuery.error && !isMissingRelationError(entitlementQuery.error)) {
    throw new Error(entitlementQuery.error.message || "Unable to load entitlements.");
  }

  const entitlements = (entitlementQuery.data ?? []) as BillingEntitlementRow[];
  const subscriptions = await fetchSubscriptionsForUser(db, userId);
  const proDiscountEligibility = calculateProDiscountEligibility(subscriptions);
  const sortedEntitlements = sortEntitlements(entitlements);
  const selectedEntitlement = sortedEntitlements[0] ?? null;

  const activePlanKey: BillingPlanKey = selectedEntitlement?.plan_key ?? "free";
  const planDefinition = getBillingPlanDefinition(activePlanKey);
  const activePlanName =
    selectedEntitlement?.source_type === "linket_offer"
      ? "Pro (free 12-month Linket claim)"
      : planDefinition.name;

  const subscriptionForSelectedEntitlement =
    selectedEntitlement?.source_type === "subscription"
      ? subscriptions.find(
          (row) => row.stripe_subscription_id === selectedEntitlement.source_id
        ) ?? subscriptions[0] ?? null
      : subscriptions[0] ?? null;

  const entitlementSnapshot = toEntitlementSnapshot(selectedEntitlement);
  const renewalDays = entitlementSnapshot?.daysUntilExpiry ?? null;
  const shouldShowRenewalPrompt = Boolean(
    selectedEntitlement &&
      selectedEntitlement.plan_key === "bundle_59" &&
      isEntitlementCurrentlyActive(selectedEntitlement) &&
      renewalDays !== null &&
      renewalDays <= BUNDLE_RENEWAL_REMINDER_WINDOW_DAYS
  );

  return {
    userId,
    activePlanKey,
    activePlanName,
    hasPaidAccess: activePlanKey !== "free",
    proDiscountEligibility,
    subscription: toSubscriptionSnapshot(subscriptionForSelectedEntitlement),
    entitlement: entitlementSnapshot,
    renewalPrompt: {
      shouldShow: shouldShowRenewalPrompt,
      daysUntilExpiry: shouldShowRenewalPrompt ? renewalDays : null,
      channel: "in_app_and_email",
    },
    availableCheckoutPlans: [...CHECKOUT_PLAN_KEYS],
  };
}

export async function getProDiscountEligibilityForUser(userId: string, client?: any) {
  const db = client ?? supabaseAdmin;
  const subscriptions = await fetchSubscriptionsForUser(db, userId);
  return calculateProDiscountEligibility(subscriptions);
}
