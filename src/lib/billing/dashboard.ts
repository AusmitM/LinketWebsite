import "server-only";

import type Stripe from "stripe";

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

export type DashboardBillingData = {
  summary: DashboardBillingSummary;
  complimentaryWindow: LinketBundleComplimentaryWindow;
  periods: DashboardBillingPeriod[];
  subscription: DashboardBillingSubscription | null;
  paymentMethods: DashboardBillingPaymentMethod[];
  invoices: DashboardBillingInvoice[];
  stripe: {
    enabled: boolean;
    customerId: string | null;
    errors: string[];
  };
};

const BILLING_PERIODS_SELECT =
  "id,provider_customer_id,provider_subscription_id,status,period_start,period_end,created_at";

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
  userId: string
) {
  const result = await stripe.customers.list({
    email,
    limit: 10,
  });
  if (result.data.length === 0) return null;

  const exactWithUserId = result.data.find(
    (customer) => customer.metadata?.user_id === userId
  );
  if (exactWithUserId?.id) return exactWithUserId.id;

  if (result.data.length === 1) {
    return result.data[0].id;
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

function pickManageableSubscriptionId(subscriptions: Stripe.Subscription[]) {
  const priority: Stripe.Subscription.Status[] = [
    "trialing",
    "active",
    "past_due",
    "unpaid",
    "incomplete",
    "paused",
  ];
  for (const status of priority) {
    const match = subscriptions.find((subscription) => subscription.status === status);
    if (match) return match.id;
  }
  return null;
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

export async function getStripeCustomerIdForUser(userId: string) {
  const rows = await fetchSubscriptionBillingPeriods(userId);
  const directCustomerId = pickPreferredCustomerId(rows);
  if (directCustomerId) return directCustomerId;

  const subscriptionId = pickPreferredSubscriptionId(rows);
  if (!subscriptionId || !getStripeSecretKey()) return null;

  try {
    const stripe = getStripeServerClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["customer"],
    });
    return readStripeCustomerId(subscription.customer);
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
  const existingCustomerId = await getStripeCustomerIdForUser(options.userId);
  if (existingCustomerId) return existingCustomerId;
  if (!getStripeSecretKey()) return null;

  const stripe = getStripeServerClient();

  const searchedByUserId = await findStripeCustomerByUserId(
    stripe,
    options.userId
  );
  if (searchedByUserId) return searchedByUserId;

  const email = options.email?.trim() ?? null;
  if (email) {
    const searchedByEmail = await findStripeCustomerByEmail(
      stripe,
      email,
      options.userId
    );
    if (searchedByEmail) return searchedByEmail;
  }

  const created = await stripe.customers.create({
    email: email ?? undefined,
    name: readStripeCustomerNameFromUser(options) ?? undefined,
    metadata: {
      user_id: options.userId,
      supabase_user_id: options.userId,
    },
  });
  return created.id;
}

export async function getDashboardBillingDataForUser(
  userId: string,
  options?: {
    email?: string | null;
  }
): Promise<DashboardBillingData> {
  const complimentaryWindow =
    await getLinketBundleComplimentaryWindowForUser(userId);
  const periodRows = await fetchSubscriptionBillingPeriods(userId);
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
  let stripeCustomerId = pickPreferredCustomerId(periodRows);
  const preferredSubscriptionId: string | null =
    pickPreferredSubscriptionId(periodRows);
  let resolvedSubscriptionId: string | null = preferredSubscriptionId;
  const stripeErrors: string[] = [];
  let subscription: DashboardBillingSubscription | null = null;
  let paymentMethods: DashboardBillingPaymentMethod[] = [];
  let invoices: DashboardBillingInvoice[] = [];

  if (stripeEnabled) {
    try {
      const stripe = getStripeServerClient();
      let defaultPaymentMethodId: string | null = null;
      const normalizedEmail = options?.email?.trim() ?? null;

      if (!stripeCustomerId) {
        try {
          stripeCustomerId = await findStripeCustomerByUserId(stripe, userId);
        } catch (error) {
          stripeErrors.push(
            formatErrorMessage("Customer lookup by user metadata failed", error)
          );
        }
      }

      if (!stripeCustomerId && normalizedEmail) {
        try {
          stripeCustomerId = await findStripeCustomerByEmail(
            stripe,
            normalizedEmail,
            userId
          );
        } catch (error) {
          stripeErrors.push(formatErrorMessage("Customer lookup by email failed", error));
        }
      }

      if (!resolvedSubscriptionId && stripeCustomerId) {
        try {
          const customerIdForLookup = stripeCustomerId;
          const subscriptions = await stripe.subscriptions.list({
            customer: customerIdForLookup,
            status: "all",
            limit: 20,
          });
          resolvedSubscriptionId = pickManageableSubscriptionId(subscriptions.data);
        } catch (error) {
          stripeErrors.push(formatErrorMessage("Subscription list lookup failed", error));
        }
      }

      if (resolvedSubscriptionId) {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(
            resolvedSubscriptionId,
            {
              expand: ["customer", "default_payment_method", "items.data.price.product"],
            }
          );
          subscription = mapStripeSubscription(stripeSubscription);
          stripeCustomerId =
            readStripeCustomerId(stripeSubscription.customer) ?? stripeCustomerId;
          defaultPaymentMethodId =
            readStripePaymentMethodId(stripeSubscription.default_payment_method) ??
            defaultPaymentMethodId;
        } catch (error) {
          stripeErrors.push(formatErrorMessage("Subscription lookup failed", error));
        }
      }

      if (stripeCustomerId) {
        try {
          const customer = await stripe.customers.retrieve(stripeCustomerId, {
            expand: ["invoice_settings.default_payment_method"],
          });
          if (!("deleted" in customer && customer.deleted)) {
            defaultPaymentMethodId =
              readStripePaymentMethodId(
                customer.invoice_settings.default_payment_method
              ) ?? defaultPaymentMethodId;
          }
        } catch (error) {
          stripeErrors.push(formatErrorMessage("Customer lookup failed", error));
        }

        try {
          const paymentMethodList = await stripe.paymentMethods.list({
            customer: stripeCustomerId,
            type: "card",
            limit: 8,
          });
          paymentMethods = paymentMethodList.data.map((method) => ({
            id: method.id,
            brand: method.card?.brand ?? null,
            last4: method.card?.last4 ?? null,
            expMonth: method.card?.exp_month ?? null,
            expYear: method.card?.exp_year ?? null,
            isDefault: method.id === defaultPaymentMethodId,
          }));
        } catch (error) {
          stripeErrors.push(
            formatErrorMessage("Payment methods lookup failed", error)
          );
        }

        try {
          const invoiceList = await stripe.invoices.list({
            customer: stripeCustomerId,
            limit: 12,
          });
          invoices = invoiceList.data.map((invoice) => {
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
        } catch (error) {
          stripeErrors.push(formatErrorMessage("Invoices lookup failed", error));
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
      subscription !== null ? !subscription.cancelAtPeriodEnd : null,
    activeSubscriptionId:
      subscription?.id ??
      activePaidPeriod?.provider_subscription_id ??
      latestPaidPeriod?.provider_subscription_id ??
      null,
    customerId: stripeCustomerId,
    paidPeriods,
    refundedPeriods,
    voidedPeriods,
  };

  return {
    summary,
    complimentaryWindow,
    periods,
    subscription,
    paymentMethods,
    invoices,
    stripe: {
      enabled: stripeEnabled,
      customerId: stripeCustomerId,
      errors: stripeErrors,
    },
  };
}
