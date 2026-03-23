import "server-only";

import type Stripe from "stripe";

import {
  isManageableStripeSubscriptionStatus,
  pickManageableSubscriptionId,
} from "@/lib/billing/complimentary-subscription";
import {
  getLinketBundleComplimentaryWindowForUser,
  type LinketBundleComplimentaryWindow,
} from "@/lib/billing/linket-bundle";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

type BillingPeriodStatus = "paid" | "refunded" | "voided";

type SubscriptionBillingPeriodRow = {
  id: string;
  provider_customer_id: string | null;
  provider_subscription_id: string;
  status: BillingPeriodStatus;
  period_start: string;
  period_end: string;
  created_at: string;
};

type StripeInvoiceCompat = Stripe.Invoice & {
  period_start?: number | null;
  period_end?: number | null;
};

type BillingOrderStatus = "pending" | "paid" | "refunded" | "canceled";
type BillingBundlePurchaseStatus = BillingOrderStatus;
type BillingEventStatus = "info" | "warning" | "error";
type BillingWarningSeverity = Exclude<BillingEventStatus, "info">;

type OrderRow = {
  id: string;
  provider_checkout_session_id: string;
  status: BillingOrderStatus;
  currency: string;
  subtotal_minor: number;
  tax_minor: number;
  shipping_minor: number;
  total_minor: number;
  receipt_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type BundlePurchaseRow = {
  id: string;
  order_id: string;
  provider_checkout_session_id: string;
  provider_payment_intent_id: string | null;
  provider_invoice_id: string | null;
  bundle_price_id: string | null;
  purchase_status: BillingBundlePurchaseStatus;
  purchased_at: string;
  quantity: number;
  shipping_rate_id: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

type BillingWarningRow = {
  id: string;
  provider_subscription_id: string | null;
  provider_customer_id: string | null;
  event_type: string;
  status: BillingEventStatus;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

type StripeSubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export type DashboardBillingPeriod = {
  id: string;
  subscriptionId: string;
  customerId: string | null;
  status: BillingPeriodStatus;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

export type DashboardBillingSummary = {
  planName: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  renewsOn: string | null;
  autoRenews: boolean | null;
  activeSubscriptionId: string | null;
  manageableSubscriptionId: string | null;
  customerId: string | null;
  paidPeriods: number;
  refundedPeriods: number;
  voidedPeriods: number;
};

export type DashboardBillingSubscription = {
  id: string;
  status: StripeSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  planName: string | null;
  priceNickname: string | null;
  collectionMethod: string | null;
};

export type DashboardBillingPaymentMethod = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
};

export type DashboardBillingInvoice = {
  id: string;
  number: string | null;
  status: string | null;
  createdAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  amountPaidMinor: number;
  amountDueMinor: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
};

export type DashboardBillingBundlePurchase = {
  id: string;
  orderId: string;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  invoiceId: string | null;
  bundlePriceId: string | null;
  orderStatus: BillingOrderStatus;
  purchaseStatus: BillingBundlePurchaseStatus;
  purchasedAt: string;
  quantity: number;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  shippingMinor: number;
  totalMinor: number;
  receiptUrl: string | null;
  shippingRateId: string | null;
  shippingName: string | null;
  shippingPhone: string | null;
  shippingAddress: Record<string, unknown> | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryDate: string | null;
  fulfillmentStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardBillingWarning = {
  id: string;
  subscriptionId: string | null;
  customerId: string | null;
  eventType: string;
  severity: BillingWarningSeverity;
  occurredAt: string;
  message: string;
};

export type DashboardBillingData = {
  summary: DashboardBillingSummary;
  complimentaryWindow: LinketBundleComplimentaryWindow;
  periods: DashboardBillingPeriod[];
  subscription: DashboardBillingSubscription | null;
  paymentMethods: DashboardBillingPaymentMethod[];
  invoices: DashboardBillingInvoice[];
  bundlePurchases: DashboardBillingBundlePurchase[];
  warnings: DashboardBillingWarning[];
  stripe: {
    enabled: boolean;
    customerId: string | null;
    errors: string[];
  };
};

const BILLING_PERIODS_SELECT =
  "id,provider_customer_id,provider_subscription_id,status,period_start,period_end,created_at";
const BILLING_ORDERS_SELECT =
  "id,provider_checkout_session_id,status,currency,subtotal_minor,tax_minor,shipping_minor,total_minor,receipt_url,metadata,created_at,updated_at";
const BILLING_BUNDLE_PURCHASES_SELECT =
  "id,order_id,provider_checkout_session_id,provider_payment_intent_id,provider_invoice_id,bundle_price_id,purchase_status,purchased_at,quantity,shipping_rate_id,shipping_name,shipping_phone,shipping_address,metadata";
const BILLING_WARNINGS_SELECT =
  "id,provider_subscription_id,provider_customer_id,event_type,status,occurred_at,metadata";

function isMissingRelationError(message: string) {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("does not exist") ||
    lowered.includes("relation") ||
    lowered.includes("schema cache")
  );
}

function toIsoDateFromUnix(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

function toTimestampMs(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function normalizeCurrency(value: string | null | undefined) {
  return value ? value.toUpperCase() : "USD";
}

function toMinorNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function readMetadataText(
  metadata: Record<string, unknown> | null,
  keys: string[]
) {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function mergeMetadata(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown> | null
) {
  if (!primary && !secondary) return null;
  return {
    ...(primary ?? {}),
    ...(secondary ?? {}),
  } satisfies Record<string, unknown>;
}

function formatErrorMessage(prefix: string, error: unknown) {
  if (error instanceof Error && error.message) {
    return `${prefix}: ${error.message}`;
  }
  return `${prefix}: unavailable`;
}

function readStripeCustomerId(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
) {
  if (typeof value === "string" && value) return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }
  return null;
}

function readStripePaymentMethodId(
  value: string | Stripe.PaymentMethod | null | undefined
) {
  if (typeof value === "string" && value) return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }
  return null;
}

function readStripeCustomerNameFromUser(options?: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const fullName = options?.fullName?.trim();
  if (fullName) return fullName;

  const first = options?.firstName?.trim() ?? "";
  const last = options?.lastName?.trim() ?? "";
  const combined = `${first} ${last}`.trim();
  return combined || null;
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

function readStripeCustomerUserId(metadata?: Stripe.Metadata | null) {
  const candidates = [metadata?.user_id, metadata?.supabase_user_id];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

async function fetchPersistedStripeCustomerIdForUser(userId: string) {
  if (isSupabaseAdminAvailable) {
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .maybeSingle<{
        stripe_customer_id: string | null;
      }>();

    if (error) {
      if (isMissingRelationError(error.message)) return null;
      throw new Error(error.message);
    }

    return data?.stripe_customer_id?.trim() || null;
  }

  const supabase = await createServerSupabaseReadonly();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle<{
      stripe_customer_id: string | null;
    }>();

  if (error) {
    if (isMissingRelationError(error.message)) return null;
    throw new Error(error.message);
  }

  return data?.stripe_customer_id?.trim() || null;
}

async function persistStripeCustomerIdForUser(
  userId: string,
  customerId: string
) {
  if (!isSupabaseAdminAvailable) return;

  const { error } = await supabaseAdmin
    .from("user_profiles")
    .update({
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error && !isMissingRelationError(error.message)) {
    throw new Error(error.message);
  }
}

async function clearPersistedStripeCustomerIdForUser(userId: string) {
  if (!isSupabaseAdminAvailable) return;

  const { error } = await supabaseAdmin
    .from("user_profiles")
    .update({
      stripe_customer_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error && !isMissingRelationError(error.message)) {
    throw new Error(error.message);
  }
}

async function fetchBundleOrdersForUser(userId: string) {
  const execute = async (
    db: typeof supabaseAdmin | Awaited<ReturnType<typeof createServerSupabaseReadonly>>
  ) => {
    const { data: orderRows, error: orderError } = await db
      .from("orders")
      .select(BILLING_ORDERS_SELECT)
      .eq("provider", "stripe")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<OrderRow[]>();

    if (orderError) throw orderError;

    const { data: bundleRows, error: bundleError } = await db
      .from("bundle_purchases")
      .select(BILLING_BUNDLE_PURCHASES_SELECT)
      .eq("provider", "stripe")
      .eq("user_id", userId)
      .order("purchased_at", { ascending: false })
      .limit(50)
      .returns<BundlePurchaseRow[]>();

    if (bundleError) throw bundleError;

    return {
      orderRows: orderRows ?? [],
      bundleRows: bundleRows ?? [],
    };
  };

  try {
    if (isSupabaseAdminAvailable) {
      return await execute(supabaseAdmin);
    }
    const supabase = await createServerSupabaseReadonly();
    return await execute(supabase);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string" &&
      isMissingRelationError((error as { message: string }).message)
    ) {
      return { orderRows: [] as OrderRow[], bundleRows: [] as BundlePurchaseRow[] };
    }
    throw error;
  }
}

function buildBillingWarningMessage(
  eventType: string,
  metadata: Record<string, unknown> | null
) {
  const subscriptionStatus =
    typeof metadata?.subscription_status === "string"
      ? metadata.subscription_status
      : null;

  if (eventType === "invoice.payment_failed") {
    return "A recent payment attempt failed. Update your card to avoid interruption.";
  }

  if (eventType === "customer.subscription.updated") {
    if (
      subscriptionStatus === "past_due" ||
      subscriptionStatus === "unpaid" ||
      subscriptionStatus === "incomplete" ||
      subscriptionStatus === "incomplete_expired"
    ) {
      return "Your subscription is at risk due to payment issues. Update your card to avoid interruption.";
    }
    if (subscriptionStatus === "canceled") {
      return "Your subscription is canceled. Re-subscribe anytime to restore paid billing.";
    }
  }

  if (eventType === "customer.subscription.deleted") {
    return "Your subscription was canceled. Re-subscribe anytime to restore paid billing.";
  }

  return "Billing needs attention. Update your payment method to keep service active.";
}

async function fetchBillingWarningsForUser(userId: string) {
  const execute = async (
    db: typeof supabaseAdmin | Awaited<ReturnType<typeof createServerSupabaseReadonly>>
  ) => {
    const { data, error } = await db
      .from("subscription_billing_events")
      .select(BILLING_WARNINGS_SELECT)
      .eq("provider", "stripe")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(50)
      .returns<BillingWarningRow[]>();

    if (error) throw error;

    const newestByBillingTarget = new Map<string, BillingWarningRow>();
    for (const row of data ?? []) {
      const key =
        row.provider_subscription_id ??
        row.provider_customer_id ??
        `event:${row.id}`;
      if (!newestByBillingTarget.has(key)) {
        newestByBillingTarget.set(key, row);
      }
    }

    return [...newestByBillingTarget.values()]
      .filter(
        (
          row
        ): row is BillingWarningRow & { status: BillingWarningSeverity } =>
          row.status === "warning" || row.status === "error"
      )
      .sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      )
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        subscriptionId: row.provider_subscription_id,
        customerId: row.provider_customer_id,
        eventType: row.event_type,
        severity: row.status,
        occurredAt: row.occurred_at,
        message: buildBillingWarningMessage(row.event_type, row.metadata),
      })) satisfies DashboardBillingWarning[];
  };

  try {
    if (isSupabaseAdminAvailable) {
      return await execute(supabaseAdmin);
    }
    const supabase = await createServerSupabaseReadonly();
    return await execute(supabase);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string" &&
      isMissingRelationError((error as { message: string }).message)
    ) {
      return [] as DashboardBillingWarning[];
    }
    throw error;
  }
}

async function findStripeCustomerByUserId(
  stripe: Stripe,
  userId: string
) {
  try {
    const escapedUserId = userId.replace(/'/g, "\\'");
    const result = await stripe.customers.search({
      query: `metadata['user_id']:'${escapedUserId}'`,
      limit: 1,
    });
    return result.data[0]?.id ?? null;
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("search") && message.includes("not")) {
      return null;
    }
    throw error;
  }
}

async function findStripeCustomerByEmail(
  stripe: Stripe,
  email: string,
  userId: string,
  options?: {
    allowSingleUnboundMatch?: boolean;
  }
) {
  const result = await stripe.customers.list({
    email,
    limit: 10,
  });
  if (result.data.length === 0) return null;

  const exactWithUserId = result.data.find(
    (customer) => readStripeCustomerUserId(customer.metadata) === userId
  );
  if (exactWithUserId) return exactWithUserId;

  if (
    options?.allowSingleUnboundMatch &&
    result.data.length === 1 &&
    !readStripeCustomerUserId(result.data[0].metadata)
  ) {
    return result.data[0];
  }

  return null;
}

function pickPreferredSubscriptionId(rows: SubscriptionBillingPeriodRow[]) {
  return (
    rows.find((row) => row.status === "paid")?.provider_subscription_id ??
    rows[0]?.provider_subscription_id ??
    null
  );
}

function pickPreferredCustomerId(rows: SubscriptionBillingPeriodRow[]) {
  return (
    rows.find((row) => row.status === "paid" && row.provider_customer_id)
      ?.provider_customer_id ??
    rows.find((row) => row.provider_customer_id)?.provider_customer_id ??
    null
  );
}

async function bindStripeCustomerToUser(
  stripe: Stripe,
  customer: Stripe.Customer,
  options: {
    userId: string;
    email?: string | null;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }
) {
  const existingUserId = readStripeCustomerUserId(customer.metadata);
  if (existingUserId && existingUserId !== options.userId) {
    return null;
  }

  const email = options.email?.trim() ?? null;
  const name = readStripeCustomerNameFromUser(options);
  const metadataNeedsUpdate =
    customer.metadata.user_id !== options.userId ||
    customer.metadata.supabase_user_id !== options.userId;
  const nextEmail =
    email && !(customer.email?.trim())
      ? email
      : undefined;
  const nextName =
    name && !(customer.name?.trim())
      ? name
      : undefined;

  if (!metadataNeedsUpdate && !nextEmail && !nextName) {
    return customer.id;
  }

  const updatedCustomer = await stripe.customers.update(customer.id, {
    ...(nextEmail ? { email: nextEmail } : {}),
    ...(nextName ? { name: nextName } : {}),
    metadata: {
      ...customer.metadata,
      user_id: options.userId,
      supabase_user_id: options.userId,
    },
  });

  return updatedCustomer.id;
}

function isStripeMissingCustomerError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  if (
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode === 404
  ) {
    return true;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  return message.includes("no such customer");
}

async function retrieveActiveStripeCustomer(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.Customer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) {
      return null;
    }
    return customer;
  } catch (error) {
    if (isStripeMissingCustomerError(error)) {
      return null;
    }
    throw error;
  }
}

async function resolveVerifiedStripeCustomerIdForUser(args: {
  stripe: Stripe;
  customerId: string;
  userId: string;
  email?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  allowBindUnboundEmail?: boolean;
  clearPersistedOnFailure?: boolean;
}) {
  const customer = await retrieveActiveStripeCustomer(args.stripe, args.customerId);
  if (!customer) {
    if (args.clearPersistedOnFailure) {
      await clearPersistedStripeCustomerIdForUser(args.userId);
    }
    return null;
  }

  const existingUserId = readStripeCustomerUserId(customer.metadata);
  if (existingUserId === args.userId) {
    return customer.id;
  }

  if (existingUserId && existingUserId !== args.userId) {
    if (args.clearPersistedOnFailure) {
      await clearPersistedStripeCustomerIdForUser(args.userId);
    }
    return null;
  }

  const normalizedCustomerEmail = normalizeEmail(customer.email);
  const normalizedUserEmail = normalizeEmail(args.email);
  if (
    !args.allowBindUnboundEmail ||
    !normalizedCustomerEmail ||
    !normalizedUserEmail ||
    normalizedCustomerEmail !== normalizedUserEmail
  ) {
    if (args.clearPersistedOnFailure) {
      await clearPersistedStripeCustomerIdForUser(args.userId);
    }
    return null;
  }

  const boundCustomerId = await bindStripeCustomerToUser(args.stripe, customer, args);
  if (!boundCustomerId) {
    if (args.clearPersistedOnFailure) {
      await clearPersistedStripeCustomerIdForUser(args.userId);
    }
    return null;
  }

  await persistStripeCustomerIdForUser(args.userId, boundCustomerId);
  return boundCustomerId;
}

function mapStripeSubscription(
  subscription: Stripe.Subscription
): DashboardBillingSubscription {
  const firstItem = subscription.items.data[0];
  const price = firstItem?.price ?? null;
  const priceNickname = price?.nickname ?? null;
  const product = price?.product;
  const planName =
    product &&
    typeof product === "object" &&
    "name" in product &&
    typeof product.name === "string"
      ? product.name
      : priceNickname;

  return {
    id: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodStart: toIsoDateFromUnix(firstItem?.current_period_start),
    currentPeriodEnd: toIsoDateFromUnix(firstItem?.current_period_end),
    planName,
    priceNickname,
    collectionMethod: subscription.collection_method ?? null,
  };
}

async function fetchSubscriptionBillingPeriods(userId: string) {
  if (isSupabaseAdminAvailable) {
    const { data, error } = await supabaseAdmin
      .from("subscription_billing_periods")
      .select(BILLING_PERIODS_SELECT)
      .eq("provider", "stripe")
      .eq("user_id", userId)
      .order("period_start", { ascending: false })
      .returns<SubscriptionBillingPeriodRow[]>();

    if (error) {
      if (isMissingRelationError(error.message)) return [];
      throw new Error(error.message);
    }

    return data ?? [];
  }

  const supabase = await createServerSupabaseReadonly();
  const { data, error } = await supabase
    .from("subscription_billing_periods")
    .select(BILLING_PERIODS_SELECT)
    .eq("provider", "stripe")
    .eq("user_id", userId)
    .order("period_start", { ascending: false })
    .returns<SubscriptionBillingPeriodRow[]>();

  if (error) {
    if (isMissingRelationError(error.message)) return [];
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getStripeCustomerIdForUser(
  userId: string,
  options?: {
    email?: string | null;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    allowBindUnboundEmail?: boolean;
  }
) {
  const persistedCustomerId = await fetchPersistedStripeCustomerIdForUser(userId);
  const stripe = getStripeSecretKey() ? getStripeServerClient() : null;
  if (persistedCustomerId) {
    if (!stripe) return persistedCustomerId;

    const verifiedPersistedCustomerId =
      await resolveVerifiedStripeCustomerIdForUser({
        stripe,
        customerId: persistedCustomerId,
        userId,
        email: options?.email ?? null,
        fullName: options?.fullName ?? null,
        firstName: options?.firstName ?? null,
        lastName: options?.lastName ?? null,
        allowBindUnboundEmail: options?.allowBindUnboundEmail ?? false,
        clearPersistedOnFailure: true,
      });
    if (verifiedPersistedCustomerId) {
      return verifiedPersistedCustomerId;
    }
  }

  const rows = await fetchSubscriptionBillingPeriods(userId);
  const directCustomerId = pickPreferredCustomerId(rows);
  if (directCustomerId) {
    if (!stripe) return directCustomerId;

    const verifiedDirectCustomerId = await resolveVerifiedStripeCustomerIdForUser({
      stripe,
      customerId: directCustomerId,
      userId,
      email: options?.email ?? null,
      fullName: options?.fullName ?? null,
      firstName: options?.firstName ?? null,
      lastName: options?.lastName ?? null,
      allowBindUnboundEmail: options?.allowBindUnboundEmail ?? false,
    });
    if (verifiedDirectCustomerId) {
      await persistStripeCustomerIdForUser(userId, verifiedDirectCustomerId);
      return verifiedDirectCustomerId;
    }
  }

  const subscriptionId = pickPreferredSubscriptionId(rows);
  if (!subscriptionId || !stripe) return null;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["customer"],
    });
    const customerId = readStripeCustomerId(subscription.customer);
    if (!customerId) return null;

    const verifiedCustomerId = await resolveVerifiedStripeCustomerIdForUser({
      stripe,
      customerId,
      userId,
      email: options?.email ?? null,
      fullName: options?.fullName ?? null,
      firstName: options?.firstName ?? null,
      lastName: options?.lastName ?? null,
      allowBindUnboundEmail: options?.allowBindUnboundEmail ?? false,
    });
    if (!verifiedCustomerId) return null;

    await persistStripeCustomerIdForUser(userId, verifiedCustomerId);
    return verifiedCustomerId;
  } catch {
    return null;
  }
}

export async function getOrCreateStripeCustomerForUser(options: {
  userId: string;
  email?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const existingCustomerId = await getStripeCustomerIdForUser(options.userId, {
    email: options.email ?? null,
    fullName: options.fullName ?? null,
    firstName: options.firstName ?? null,
    lastName: options.lastName ?? null,
    allowBindUnboundEmail: true,
  });
  if (existingCustomerId) {
    await persistStripeCustomerIdForUser(options.userId, existingCustomerId);
    return existingCustomerId;
  }
  if (!getStripeSecretKey()) return null;

  const stripe = getStripeServerClient();

  const searchedByUserId = await findStripeCustomerByUserId(
    stripe,
    options.userId
  );
  if (searchedByUserId) {
    await persistStripeCustomerIdForUser(options.userId, searchedByUserId);
    return searchedByUserId;
  }

  const email = options.email?.trim() ?? null;
  if (email) {
    const searchedByEmail = await findStripeCustomerByEmail(
      stripe,
      email,
      options.userId,
      {
        allowSingleUnboundMatch: true,
      }
    );
    if (searchedByEmail) {
      const boundCustomerId = await bindStripeCustomerToUser(
        stripe,
        searchedByEmail,
        options
      );
      if (boundCustomerId) {
        await persistStripeCustomerIdForUser(options.userId, boundCustomerId);
        return boundCustomerId;
      }
    }
  }

  const created = await stripe.customers.create({
    email: email ?? undefined,
    name: readStripeCustomerNameFromUser(options) ?? undefined,
    metadata: {
      user_id: options.userId,
      supabase_user_id: options.userId,
    },
  });
  await persistStripeCustomerIdForUser(options.userId, created.id);
  return created.id;
}

export async function getDashboardBillingDataForUser(
  userId: string,
  options?: {
    email?: string | null;
  }
): Promise<DashboardBillingData> {
  const [complimentaryWindow, { orderRows, bundleRows }, periodRows, warnings] =
    await Promise.all([
      getLinketBundleComplimentaryWindowForUser(userId),
      fetchBundleOrdersForUser(userId),
      fetchSubscriptionBillingPeriods(userId),
      fetchBillingWarningsForUser(userId),
    ]);
  const periods: DashboardBillingPeriod[] = periodRows.map((row) => ({
    id: row.id,
    subscriptionId: row.provider_subscription_id,
    customerId: row.provider_customer_id,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
  }));

  const nowMs = Date.now();
  const activePaidPeriod = periodRows.find((row) => {
    if (row.status !== "paid") return false;
    const startMs = toTimestampMs(row.period_start);
    const endMs = toTimestampMs(row.period_end);
    if (startMs === null || endMs === null) return false;
    return startMs <= nowMs && nowMs < endMs;
  });
  const latestPaidPeriod = periodRows.find((row) => row.status === "paid");

  const paidPeriods = periodRows.filter((row) => row.status === "paid").length;
  const refundedPeriods = periodRows.filter(
    (row) => row.status === "refunded"
  ).length;
  const voidedPeriods = periodRows.filter((row) => row.status === "voided").length;

  let stripeEnabled = Boolean(getStripeSecretKey());
  let stripeCustomerId = await getStripeCustomerIdForUser(userId, {
    email: options?.email ?? null,
    allowBindUnboundEmail: true,
  });
  const preferredSubscriptionId: string | null =
    pickPreferredSubscriptionId(periodRows);
  let resolvedSubscriptionId: string | null = null;
  let manageableSubscriptionId: string | null = null;
  const stripeErrors: string[] = [];
  let subscription: DashboardBillingSubscription | null = null;
  let paymentMethods: DashboardBillingPaymentMethod[] = [];
  let invoices: DashboardBillingInvoice[] = [];

  if (stripeEnabled) {
    try {
      const stripe = getStripeServerClient();
      let defaultPaymentMethodId: string | null = null;
      let preloadedSubscription: Stripe.Subscription | null = null;
      const normalizedEmail = options?.email?.trim() ?? null;

      if (!stripeCustomerId) {
        try {
          stripeCustomerId = await findStripeCustomerByUserId(stripe, userId);
          if (stripeCustomerId) {
            const verifiedCustomerId = await resolveVerifiedStripeCustomerIdForUser({
              stripe,
              customerId: stripeCustomerId,
              userId,
              email: options?.email ?? null,
              allowBindUnboundEmail: true,
            });
            stripeCustomerId = verifiedCustomerId;
          }
          if (stripeCustomerId) {
            await persistStripeCustomerIdForUser(userId, stripeCustomerId);
          }
        } catch (error) {
          stripeErrors.push(
            formatErrorMessage("Customer lookup by user metadata failed", error)
          );
        }
      }

      if (!stripeCustomerId && normalizedEmail) {
        try {
          const customer = await findStripeCustomerByEmail(
            stripe,
            normalizedEmail,
            userId
          );
          stripeCustomerId = customer?.id ?? null;
          if (stripeCustomerId) {
            await persistStripeCustomerIdForUser(userId, stripeCustomerId);
          }
        } catch (error) {
          stripeErrors.push(formatErrorMessage("Customer lookup by email failed", error));
        }
      }

      if (stripeCustomerId) {
        try {
          const customerIdForLookup = stripeCustomerId;
          const subscriptions = await stripe.subscriptions.list({
            customer: customerIdForLookup,
            status: "all",
            limit: 20,
          });
          manageableSubscriptionId = pickManageableSubscriptionId(subscriptions.data);
          resolvedSubscriptionId =
            manageableSubscriptionId ?? preferredSubscriptionId;
        } catch (error) {
          stripeErrors.push(formatErrorMessage("Subscription list lookup failed", error));
        }
      }

      if (!resolvedSubscriptionId && preferredSubscriptionId) {
        resolvedSubscriptionId = preferredSubscriptionId;
      }

      if (resolvedSubscriptionId && !stripeCustomerId) {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(
            resolvedSubscriptionId,
            {
              expand: ["customer", "default_payment_method", "items.data.price.product"],
            }
          );
          preloadedSubscription = stripeSubscription;
          stripeCustomerId =
            readStripeCustomerId(stripeSubscription.customer) ?? stripeCustomerId;
          if (stripeCustomerId) {
            const verifiedCustomerId = await resolveVerifiedStripeCustomerIdForUser({
              stripe,
              customerId: stripeCustomerId,
              userId,
              email: options?.email ?? null,
              allowBindUnboundEmail: true,
            });
            stripeCustomerId = verifiedCustomerId;
          }
          if (stripeCustomerId) {
            await persistStripeCustomerIdForUser(userId, stripeCustomerId);
          }
          defaultPaymentMethodId =
            readStripePaymentMethodId(stripeSubscription.default_payment_method) ??
            defaultPaymentMethodId;
        } catch (error) {
          stripeErrors.push(formatErrorMessage("Subscription lookup failed", error));
        }
      }

      if (stripeCustomerId) {
        const [subscriptionResult, customerResult, paymentMethodsResult, invoicesResult] =
          await Promise.allSettled([
            preloadedSubscription
              ? Promise.resolve(preloadedSubscription)
              : resolvedSubscriptionId
                ? stripe.subscriptions.retrieve(resolvedSubscriptionId, {
                    expand: [
                      "customer",
                      "default_payment_method",
                      "items.data.price.product",
                    ],
                  })
                : Promise.resolve(null),
            stripe.customers.retrieve(stripeCustomerId, {
              expand: ["invoice_settings.default_payment_method"],
            }),
            stripe.paymentMethods.list({
              customer: stripeCustomerId,
              type: "card",
              limit: 50,
            }),
            stripe.invoices.list({
              customer: stripeCustomerId,
              limit: 12,
            }),
          ]);

        if (subscriptionResult.status === "fulfilled") {
          const stripeSubscription = subscriptionResult.value;
          if (stripeSubscription) {
            subscription = mapStripeSubscription(stripeSubscription);
            if (isManageableStripeSubscriptionStatus(stripeSubscription.status)) {
              manageableSubscriptionId = stripeSubscription.id;
            }
            stripeCustomerId =
              readStripeCustomerId(stripeSubscription.customer) ?? stripeCustomerId;
            defaultPaymentMethodId =
              readStripePaymentMethodId(stripeSubscription.default_payment_method) ??
              defaultPaymentMethodId;
          }
        } else {
          stripeErrors.push(
            formatErrorMessage("Subscription lookup failed", subscriptionResult.reason)
          );
        }

        if (customerResult.status === "fulfilled") {
          const customer = customerResult.value;
          if (!("deleted" in customer && customer.deleted)) {
            defaultPaymentMethodId =
              readStripePaymentMethodId(
                customer.invoice_settings.default_payment_method
              ) ?? defaultPaymentMethodId;
          }
        } else {
          stripeErrors.push(
            formatErrorMessage("Customer lookup failed", customerResult.reason)
          );
        }

        if (paymentMethodsResult.status === "fulfilled") {
          paymentMethods = paymentMethodsResult.value.data.map((method) => ({
            id: method.id,
            brand: method.card?.brand ?? null,
            last4: method.card?.last4 ?? null,
            expMonth: method.card?.exp_month ?? null,
            expYear: method.card?.exp_year ?? null,
            isDefault: method.id === defaultPaymentMethodId,
          }));
        } else {
          stripeErrors.push(
            formatErrorMessage(
              "Payment methods lookup failed",
              paymentMethodsResult.reason
            )
          );
        }

        if (invoicesResult.status === "fulfilled") {
          invoices = invoicesResult.value.data.map((invoice) => {
            const compat = invoice as StripeInvoiceCompat;
            return {
              id: invoice.id,
              number: invoice.number ?? null,
              status: invoice.status ?? null,
              createdAt: toIsoDateFromUnix(invoice.created),
              periodStart: toIsoDateFromUnix(compat.period_start),
              periodEnd: toIsoDateFromUnix(compat.period_end),
              amountPaidMinor: invoice.amount_paid ?? 0,
              amountDueMinor: invoice.amount_due ?? 0,
              currency: normalizeCurrency(invoice.currency),
              hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
              invoicePdfUrl: invoice.invoice_pdf ?? null,
            };
          });
        } else {
          stripeErrors.push(
            formatErrorMessage("Invoices lookup failed", invoicesResult.reason)
          );
        }
      }
    } catch (error) {
      stripeEnabled = false;
      stripeErrors.push(formatErrorMessage("Stripe initialization failed", error));
    }
  }

  const summaryStatus =
    subscription?.status ??
    (complimentaryWindow.active
      ? "complimentary"
      : activePaidPeriod
        ? "active"
        : paidPeriods > 0
          ? "inactive"
          : "free");

  const summary: DashboardBillingSummary = {
    planName:
      subscription?.planName ??
      (complimentaryWindow.active
        ? "Paid Web-Only (Pro) - Complimentary"
        : paidPeriods > 0
          ? "Paid Web-Only (Pro)"
          : "Free plan"),
    status: summaryStatus,
    currentPeriodStart:
      subscription?.currentPeriodStart ??
      activePaidPeriod?.period_start ??
      latestPaidPeriod?.period_start ??
      null,
    currentPeriodEnd:
      subscription?.currentPeriodEnd ??
      activePaidPeriod?.period_end ??
      latestPaidPeriod?.period_end ??
      null,
    renewsOn:
      complimentaryWindow.active
        ? complimentaryWindow.endsAt
        : subscription?.currentPeriodEnd ?? activePaidPeriod?.period_end ?? null,
    autoRenews:
      subscription !== null
        ? isManageableStripeSubscriptionStatus(subscription.status)
          ? !subscription.cancelAtPeriodEnd
          : false
        : null,
    activeSubscriptionId:
      subscription?.id ??
      activePaidPeriod?.provider_subscription_id ??
      latestPaidPeriod?.provider_subscription_id ??
      null,
    manageableSubscriptionId,
    customerId: stripeCustomerId,
    paidPeriods,
    refundedPeriods,
    voidedPeriods,
  };

  const orderById = new Map(orderRows.map((row) => [row.id, row] as const));
  const bundlePurchases: DashboardBillingBundlePurchase[] = bundleRows
    .map((bundleRow) => {
      const orderRow = orderById.get(bundleRow.order_id);
      const shippingMetadata = mergeMetadata(orderRow?.metadata ?? null, bundleRow.metadata);
      const trackingNumber = readMetadataText(shippingMetadata, [
        "tracking_number",
        "trackingNumber",
        "shipment_tracking_number",
      ]);
      const trackingUrl = readMetadataText(shippingMetadata, [
        "tracking_url",
        "trackingUrl",
        "shipment_tracking_url",
      ]);
      const estimatedDeliveryDate = readMetadataText(shippingMetadata, [
        "estimated_delivery_at",
        "estimatedDeliveryAt",
        "estimated_delivery_date",
        "estimatedDeliveryDate",
        "eta",
      ]);
      const fulfillmentStatus = readMetadataText(shippingMetadata, [
        "fulfillment_status",
        "fulfillmentStatus",
        "shipping_status",
        "shippingStatus",
      ]);

      return {
        id: bundleRow.id,
        orderId: bundleRow.order_id,
        checkoutSessionId:
          bundleRow.provider_checkout_session_id ??
          orderRow?.provider_checkout_session_id ??
          "",
        paymentIntentId: bundleRow.provider_payment_intent_id ?? null,
        invoiceId: bundleRow.provider_invoice_id ?? null,
        bundlePriceId: bundleRow.bundle_price_id ?? null,
        orderStatus: orderRow?.status ?? "pending",
        purchaseStatus: bundleRow.purchase_status,
        purchasedAt: bundleRow.purchased_at,
        quantity: bundleRow.quantity,
        currency: normalizeCurrency(orderRow?.currency),
        subtotalMinor: toMinorNumber(orderRow?.subtotal_minor),
        taxMinor: toMinorNumber(orderRow?.tax_minor),
        shippingMinor: toMinorNumber(orderRow?.shipping_minor),
        totalMinor: toMinorNumber(orderRow?.total_minor),
        receiptUrl: orderRow?.receipt_url ?? null,
        shippingRateId: bundleRow.shipping_rate_id ?? null,
        shippingName: bundleRow.shipping_name ?? null,
        shippingPhone: bundleRow.shipping_phone ?? null,
        shippingAddress: bundleRow.shipping_address ?? null,
        trackingNumber,
        trackingUrl,
        estimatedDeliveryDate,
        fulfillmentStatus,
        createdAt: orderRow?.created_at ?? bundleRow.purchased_at,
        updatedAt: orderRow?.updated_at ?? bundleRow.purchased_at,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
    );

  return {
    summary,
    complimentaryWindow,
    periods,
    subscription,
    paymentMethods,
    invoices,
    bundlePurchases,
    warnings,
    stripe: {
      enabled: stripeEnabled,
      customerId: stripeCustomerId,
      errors: stripeErrors,
    },
  };
}
