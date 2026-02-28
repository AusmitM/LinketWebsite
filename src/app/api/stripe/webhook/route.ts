import { NextResponse } from "next/server";
import Stripe from "stripe";

import { ensureNoChargeDuringComplimentary } from "@/lib/billing/complimentary-subscription";
import { getLinketBundleComplimentaryWindowForUser } from "@/lib/billing/linket-bundle";
import { getPersonalProPriceIds, getStripeServerClient, getStripeWebhookSecret } from "@/lib/stripe";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PeriodWindow = {
  start: number;
  end: number;
};

type InvoiceLineItemCompat = Stripe.InvoiceLineItem & {
  type?: string | null;
  period?: {
    start?: number | null;
    end?: number | null;
  } | null;
  price?: Stripe.Price | string | null;
  pricing?: {
    price_details?: {
      price?: string | null;
      product?: string | null;
    } | null;
  } | null;
  parent?: {
    type?: string | null;
    subscription_item_details?: {
      subscription?: string | null;
      subscription_item?: string | null;
    } | null;
  } | null;
};

type InvoiceCompat = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  charge?: string | Stripe.Charge | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
  period_start?: number | null;
  period_end?: number | null;
  lines?: {
    data?: InvoiceLineItemCompat[];
  } | null;
  parent?: {
    type?: string | null;
    subscription_details?: {
      subscription?: string | null;
      metadata?: Stripe.Metadata | null;
    } | null;
  } | null;
};

type ChargeCompat = Stripe.Charge & {
  invoice?: string | { id: string } | null;
};

type SubscriptionCompat = Stripe.Subscription & {
  customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
};

type BillingEventSeverity = "info" | "warning" | "error";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isMissingRelationError(message: string) {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("does not exist") ||
    lowered.includes("relation") ||
    lowered.includes("schema cache")
  );
}

function readUserIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined
) {
  if (!metadata) return null;
  const candidates = [
    metadata.user_id,
    metadata.userId,
    metadata.supabase_user_id,
    metadata.supabaseUserId,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (isUuid(trimmed)) return trimmed;
  }
  return null;
}

function getSubscriptionId(invoice: Stripe.Invoice) {
  const compat = invoice as InvoiceCompat;
  if (typeof compat.subscription === "string") return compat.subscription;
  if (
    compat.subscription &&
    typeof compat.subscription === "object" &&
    "id" in compat.subscription
  ) {
    return compat.subscription.id;
  }

  const parentSubscription =
    compat.parent?.subscription_details?.subscription ?? null;
  if (typeof parentSubscription === "string" && parentSubscription) {
    return parentSubscription;
  }

  const lineSubscription = (compat.lines?.data ?? [])
    .map((line) => line.parent?.subscription_item_details?.subscription ?? null)
    .find((value): value is string => typeof value === "string" && value.length > 0);
  if (lineSubscription) return lineSubscription;

  return null;
}

function getCustomerId(invoice: Stripe.Invoice) {
  const compat = invoice as InvoiceCompat;
  if (typeof compat.customer === "string") return compat.customer;
  if (
    compat.customer &&
    typeof compat.customer === "object" &&
    "id" in compat.customer
  ) {
    return compat.customer.id;
  }
  return null;
}

function getCustomerIdFromSubscription(subscription: Stripe.Subscription) {
  const compat = subscription as SubscriptionCompat;
  if (typeof compat.customer === "string") return compat.customer;
  if (
    compat.customer &&
    typeof compat.customer === "object" &&
    "id" in compat.customer
  ) {
    return compat.customer.id;
  }
  return null;
}

function getChargeIdFromInvoice(invoice: Stripe.Invoice) {
  const compat = invoice as InvoiceCompat;
  if (typeof compat.charge === "string" && compat.charge) {
    return compat.charge;
  }
  if (
    compat.charge &&
    typeof compat.charge === "object" &&
    "id" in compat.charge &&
    typeof compat.charge.id === "string"
  ) {
    return compat.charge.id;
  }
  return null;
}

function getPaymentIntentIdFromInvoice(invoice: Stripe.Invoice) {
  const compat = invoice as InvoiceCompat;
  if (typeof compat.payment_intent === "string" && compat.payment_intent) {
    return compat.payment_intent;
  }
  if (
    compat.payment_intent &&
    typeof compat.payment_intent === "object" &&
    "id" in compat.payment_intent &&
    typeof compat.payment_intent.id === "string"
  ) {
    return compat.payment_intent.id;
  }
  return null;
}

function toLowerText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readScopeFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  if (!metadata) return null;
  const scopeFields = [
    metadata.loyalty_scope,
    metadata.plan_scope,
    metadata.applies_to,
    metadata.account_type,
    metadata.plan_type,
    metadata.usage_scope,
  ];
  for (const entry of scopeFields) {
    const normalized = toLowerText(entry);
    if (!normalized) continue;
    if (
      normalized.includes("personal") ||
      normalized.includes("individual")
    ) {
      return "personal";
    }
    if (
      normalized.includes("business") ||
      normalized.includes("enterprise") ||
      normalized.includes("team")
    ) {
      return "business";
    }
  }
  return null;
}

function containsAnyKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function isInvoiceEligibleForPersonalLoyalty(
  invoice: Stripe.Invoice,
  personalProPriceIds: Set<string>
) {
  const compat = invoice as InvoiceCompat;
  const lineItems = (compat.lines?.data ?? []) as InvoiceLineItemCompat[];
  if (personalProPriceIds.size > 0) {
    return lineItems.some((line) => {
      const legacyPriceId =
        typeof line.price === "string"
          ? line.price
          : line.price?.id ?? null;
      const cloverPriceId = line.pricing?.price_details?.price ?? null;
      const candidateIds = [legacyPriceId, cloverPriceId].filter(
        (value): value is string => typeof value === "string" && value.length > 0
      );
      return candidateIds.some((priceId) => personalProPriceIds.has(priceId));
    });
  }

  const subscriptionMetadata =
    compat.subscription &&
    typeof compat.subscription === "object" &&
    "metadata" in compat.subscription
      ? compat.subscription.metadata
      : null;
  const customerMetadata =
    compat.customer &&
    typeof compat.customer === "object" &&
    "deleted" in compat.customer &&
    compat.customer.deleted
      ? null
      : compat.customer &&
          typeof compat.customer === "object" &&
          "metadata" in compat.customer
        ? compat.customer.metadata
        : null;

  const metadataScopes = [
    readScopeFromMetadata(invoice.metadata),
    readScopeFromMetadata(subscriptionMetadata),
    readScopeFromMetadata(customerMetadata),
  ];
  if (metadataScopes.includes("business")) return false;
  if (metadataScopes.includes("personal")) return true;

  for (const line of lineItems) {
    const text = `${toLowerText(line.description)} ${toLowerText(
      (line as { price?: { nickname?: string | null } | null }).price?.nickname
    )}`;
    if (!text) continue;
    if (containsAnyKeyword(text, ["business", "enterprise", "team"])) {
      return false;
    }
    if (containsAnyKeyword(text, ["personal", "individual", "pro"])) {
      return true;
    }
  }

  return true;
}

function collectInvoicePeriods(invoice: Stripe.Invoice): PeriodWindow[] {
  const compat = invoice as InvoiceCompat;
  const periods = new Map<string, PeriodWindow>();

  for (const line of compat.lines?.data ?? []) {
    const isSubscriptionLine =
      line.type === "subscription" ||
      line.parent?.type === "subscription_item_details" ||
      Boolean(line.parent?.subscription_item_details?.subscription);
    if (!isSubscriptionLine) continue;

    const start = line.period?.start;
    const end = line.period?.end;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (!start || !end || end <= start) continue;
    const key = `${start}-${end}`;
    periods.set(key, { start, end });
  }

  if (periods.size === 0) {
    const start = compat.period_start;
    const end = compat.period_end;
    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start &&
      end &&
      end > start
    ) {
      periods.set(`${start}-${end}`, { start, end });
    }
  }

  return [...periods.values()];
}

function isWithinComplimentaryWindow(
  periods: PeriodWindow[],
  complimentaryStartsAt: string | null,
  complimentaryEndsAt: string | null
) {
  if (!complimentaryStartsAt || !complimentaryEndsAt) return false;
  const startsAtMs = new Date(complimentaryStartsAt).getTime();
  const endsAtMs = new Date(complimentaryEndsAt).getTime();
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) return false;
  return (
    periods.length > 0 &&
    periods.every(
      (period) =>
        period.start * 1000 >= startsAtMs && period.end * 1000 <= endsAtMs
    )
  );
}

async function resolveChargeIdForInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice
) {
  const directChargeId = getChargeIdFromInvoice(invoice);
  if (directChargeId) return directChargeId;

  const paymentIntentId = getPaymentIntentIdFromInvoice(invoice);
  if (!paymentIntentId) return null;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (typeof paymentIntent.latest_charge === "string" && paymentIntent.latest_charge) {
    return paymentIntent.latest_charge;
  }
  if (
    paymentIntent.latest_charge &&
    typeof paymentIntent.latest_charge === "object" &&
    "id" in paymentIntent.latest_charge &&
    typeof paymentIntent.latest_charge.id === "string"
  ) {
    return paymentIntent.latest_charge.id;
  }
  return null;
}

async function refundComplimentaryInvoiceIfNeeded(args: {
  stripe: Stripe;
  invoice: Stripe.Invoice;
  userId: string;
}) {
  if ((args.invoice.amount_paid ?? 0) <= 0) return;

  const chargeId = await resolveChargeIdForInvoice(args.stripe, args.invoice);
  if (!chargeId) {
    throw new Error(`Unable to find charge for complimentary invoice ${args.invoice.id}`);
  }

  const charge = await args.stripe.charges.retrieve(chargeId);
  const alreadyRefunded = charge.refunded || charge.amount_refunded >= charge.amount;
  if (alreadyRefunded) return;

  const remainingChargeAmount = Math.max(0, charge.amount - charge.amount_refunded);
  const requestedAmount = Math.max(0, args.invoice.amount_paid ?? 0);
  const refundAmount = Math.min(remainingChargeAmount, requestedAmount);
  if (refundAmount <= 0) return;

  await args.stripe.refunds.create(
    {
      charge: charge.id,
      amount: refundAmount,
      metadata: {
        reason: "linket_bundle_complimentary_window",
        invoice_id: args.invoice.id,
        user_id: args.userId,
      },
    },
    {
      idempotencyKey: `linket-bundle-complimentary-${args.invoice.id}`,
    }
  );
}

async function lookupUserIdFromExistingPeriods(
  field: "provider_subscription_id" | "provider_customer_id",
  value: string
) {
  if (!isSupabaseAdminAvailable) return null;
  const query = supabaseAdmin
    .from("subscription_billing_periods")
    .select("user_id")
    .eq("provider", "stripe")
    .eq(field, value)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await query;
  if (error) {
    const lowered = error.message.toLowerCase();
    if (lowered.includes("does not exist") || lowered.includes("schema cache")) {
      return null;
    }
    throw new Error(error.message);
  }

  if (data?.user_id && isUuid(data.user_id)) return data.user_id;
  return null;
}

async function resolveUserIdForInvoice(
  invoice: Stripe.Invoice,
  stripe: Stripe
) {
  const compat = invoice as InvoiceCompat;
  const metadataUserId = readUserIdFromMetadata(invoice.metadata);
  if (metadataUserId) return metadataUserId;

  if (
    compat.customer &&
    typeof compat.customer === "object" &&
    !("deleted" in compat.customer && compat.customer.deleted) &&
    "metadata" in compat.customer
  ) {
    const customerUserId = readUserIdFromMetadata(compat.customer.metadata);
    if (customerUserId) return customerUserId;
  }

  if (
    compat.subscription &&
    typeof compat.subscription === "object" &&
    "metadata" in compat.subscription
  ) {
    const subscriptionUserId = readUserIdFromMetadata(
      compat.subscription.metadata
    );
    if (subscriptionUserId) return subscriptionUserId;
  }

  const subscriptionId = getSubscriptionId(invoice);
  if (subscriptionId) {
    const existingSubscriptionUser = await lookupUserIdFromExistingPeriods(
      "provider_subscription_id",
      subscriptionId
    );
    if (existingSubscriptionUser) return existingSubscriptionUser;
  }

  const customerId = getCustomerId(invoice);
  if (customerId) {
    const existingCustomerUser = await lookupUserIdFromExistingPeriods(
      "provider_customer_id",
      customerId
    );
    if (existingCustomerUser) return existingCustomerUser;
  }

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["customer"],
    });
    const subscriptionUserId = readUserIdFromMetadata(subscription.metadata);
    if (subscriptionUserId) return subscriptionUserId;

    if (
      subscription.customer &&
      typeof subscription.customer === "object" &&
      !("deleted" in subscription.customer && subscription.customer.deleted) &&
      "metadata" in subscription.customer
    ) {
      const customerUserId = readUserIdFromMetadata(
        subscription.customer.metadata
      );
      if (customerUserId) return customerUserId;
    }
  }

  if (customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (
      customer &&
      typeof customer === "object" &&
      "metadata" in customer &&
      customer.metadata
    ) {
      const customerUserId = readUserIdFromMetadata(customer.metadata);
      if (customerUserId) return customerUserId;
    }
  }

  return null;
}

function readCheckoutCustomerId(session: Stripe.Checkout.Session) {
  if (typeof session.customer === "string") return session.customer;
  if (session.customer && typeof session.customer === "object") {
    return session.customer.id ?? null;
  }
  return null;
}

function readCheckoutPaymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  if (session.payment_intent && typeof session.payment_intent === "object") {
    return session.payment_intent.id ?? null;
  }
  return null;
}

function readCheckoutInvoiceId(session: Stripe.Checkout.Session) {
  if (typeof session.invoice === "string") return session.invoice;
  if (session.invoice && typeof session.invoice === "object") {
    return session.invoice.id ?? null;
  }
  return null;
}

function readCheckoutShippingRateId(session: Stripe.Checkout.Session) {
  const shippingRate = session.shipping_cost?.shipping_rate ?? null;
  if (typeof shippingRate === "string") return shippingRate;
  if (shippingRate && typeof shippingRate === "object") {
    return shippingRate.id ?? null;
  }
  return null;
}

type CheckoutShippingDetails = {
  shippingAddress: Stripe.Address | null;
  shippingName: string | null;
  shippingPhone: string | null;
};

function readCheckoutShippingDetails(
  session: Stripe.Checkout.Session
): CheckoutShippingDetails {
  const shippingDetails = session.collected_information?.shipping_details ?? null;
  return {
    shippingAddress:
      shippingDetails?.address ?? session.customer_details?.address ?? null,
    shippingName: shippingDetails?.name ?? session.customer_details?.name ?? null,
    shippingPhone: session.customer_details?.phone ?? null,
  };
}

async function resolveCheckoutShippingDetails(args: {
  stripe: Stripe;
  session: Stripe.Checkout.Session;
  customerId: string | null;
}): Promise<CheckoutShippingDetails> {
  let details = readCheckoutShippingDetails(args.session);

  if ((!details.shippingAddress || !details.shippingName) && args.session.id) {
    try {
      const refreshedSession = await args.stripe.checkout.sessions.retrieve(
        args.session.id
      );
      const refreshedDetails = readCheckoutShippingDetails(refreshedSession);
      details = {
        shippingAddress: details.shippingAddress ?? refreshedDetails.shippingAddress,
        shippingName: details.shippingName ?? refreshedDetails.shippingName,
        shippingPhone: details.shippingPhone ?? refreshedDetails.shippingPhone,
      };
    } catch (error) {
      console.warn(
        `Stripe webhook shipping details refresh failed for checkout session ${args.session.id}`,
        error
      );
    }
  }

  if (
    (!details.shippingAddress || !details.shippingName || !details.shippingPhone) &&
    args.customerId
  ) {
    try {
      const customer = await args.stripe.customers.retrieve(args.customerId);
      if (
        customer &&
        typeof customer === "object" &&
        !("deleted" in customer && customer.deleted)
      ) {
        details = {
          shippingAddress:
            details.shippingAddress ?? customer.shipping?.address ?? null,
          shippingName:
            details.shippingName ?? customer.shipping?.name ?? customer.name ?? null,
          shippingPhone:
            details.shippingPhone ?? customer.shipping?.phone ?? customer.phone ?? null,
        };
      }
    } catch (error) {
      console.warn(
        `Stripe webhook customer shipping fallback failed for customer ${args.customerId}`,
        error
      );
    }
  }

  return details;
}

function mapCheckoutPaymentStatusToOrderStatus(
  paymentStatus: Stripe.Checkout.Session.PaymentStatus | null | undefined
) {
  if (paymentStatus === "paid" || paymentStatus === "no_payment_required") {
    return "paid" as const;
  }
  if (paymentStatus === "unpaid") {
    return "pending" as const;
  }
  return "pending" as const;
}

function mapCheckoutPaymentStatusToPurchaseStatus(
  paymentStatus: Stripe.Checkout.Session.PaymentStatus | null | undefined
) {
  if (paymentStatus === "paid" || paymentStatus === "no_payment_required") {
    return "paid" as const;
  }
  if (paymentStatus === "unpaid") {
    return "pending" as const;
  }
  return "pending" as const;
}

async function resolveUserIdForCheckoutSession(
  session: Stripe.Checkout.Session,
  stripe: Stripe
) {
  const metadataUserId = readUserIdFromMetadata(session.metadata);
  if (metadataUserId) return metadataUserId;

  if (session.client_reference_id && isUuid(session.client_reference_id)) {
    return session.client_reference_id;
  }

  if (
    session.customer &&
    typeof session.customer === "object" &&
    "metadata" in session.customer
  ) {
    const customerUserId = readUserIdFromMetadata(
      session.customer.metadata ?? null
    );
    if (customerUserId) return customerUserId;
  }

  const customerId = readCheckoutCustomerId(session);
  if (!customerId) return null;

  const customer = await stripe.customers.retrieve(customerId);
  if (
    customer &&
    typeof customer === "object" &&
    "metadata" in customer &&
    customer.metadata
  ) {
    const customerUserId = readUserIdFromMetadata(customer.metadata);
    if (customerUserId) return customerUserId;
  }

  return null;
}

async function resolveUserIdForSubscription(
  subscription: Stripe.Subscription,
  stripe: Stripe
) {
  const metadataUserId = readUserIdFromMetadata(subscription.metadata);
  if (metadataUserId) return metadataUserId;

  const existingSubscriptionUser = await lookupUserIdFromExistingPeriods(
    "provider_subscription_id",
    subscription.id
  );
  if (existingSubscriptionUser) return existingSubscriptionUser;

  const customerId = getCustomerIdFromSubscription(subscription);
  if (customerId) {
    const existingCustomerUser = await lookupUserIdFromExistingPeriods(
      "provider_customer_id",
      customerId
    );
    if (existingCustomerUser) return existingCustomerUser;
  }

  if (
    subscription.customer &&
    typeof subscription.customer === "object" &&
    !("deleted" in subscription.customer && subscription.customer.deleted) &&
    "metadata" in subscription.customer
  ) {
    const customerUserId = readUserIdFromMetadata(subscription.customer.metadata);
    if (customerUserId) return customerUserId;
  }

  const customerIdForLookup = customerId;
  if (!customerIdForLookup) return null;

  const customer = await stripe.customers.retrieve(customerIdForLookup);
  if (
    customer &&
    typeof customer === "object" &&
    "metadata" in customer &&
    customer.metadata
  ) {
    const customerUserId = readUserIdFromMetadata(customer.metadata);
    if (customerUserId) return customerUserId;
  }

  return null;
}

function readChargeReceiptUrl(
  charge:
    | Stripe.Charge
    | {
        receipt_url?: string | null;
      }
    | null
    | undefined
) {
  if (!charge || typeof charge !== "object") return null;
  if ("receipt_url" in charge && typeof charge.receipt_url === "string") {
    return charge.receipt_url;
  }
  return null;
}

async function resolveReceiptUrlForCheckoutSession(args: {
  stripe: Stripe;
  invoiceId: string | null;
  paymentIntentId: string | null;
}) {
  if (args.invoiceId) {
    try {
      const invoice = await args.stripe.invoices.retrieve(args.invoiceId);
      if (invoice.hosted_invoice_url) return invoice.hosted_invoice_url;
      if (invoice.invoice_pdf) return invoice.invoice_pdf;
    } catch (error) {
      console.warn(
        `Stripe webhook invoice lookup failed while resolving receipt URL (${args.invoiceId})`,
        error
      );
    }
  }

  if (args.paymentIntentId) {
    try {
      const paymentIntent = await args.stripe.paymentIntents.retrieve(
        args.paymentIntentId,
        {
          expand: ["latest_charge"],
        }
      );
      if (
        paymentIntent.latest_charge &&
        typeof paymentIntent.latest_charge === "object"
      ) {
        const latestChargeReceiptUrl = readChargeReceiptUrl(
          paymentIntent.latest_charge
        );
        if (latestChargeReceiptUrl) return latestChargeReceiptUrl;
      }
      if (typeof paymentIntent.latest_charge === "string") {
        const charge = await args.stripe.charges.retrieve(
          paymentIntent.latest_charge
        );
        const chargeReceiptUrl = readChargeReceiptUrl(charge);
        if (chargeReceiptUrl) return chargeReceiptUrl;
      }
    } catch (error) {
      console.warn(
        `Stripe webhook payment intent lookup failed while resolving receipt URL (${args.paymentIntentId})`,
        error
      );
    }
  }

  return null;
}

async function updateBundleOrderAndPurchaseStatusesBySession(args: {
  checkoutSessionId: string;
  orderStatus: "pending" | "paid" | "refunded" | "canceled";
  purchaseStatus: "pending" | "paid" | "refunded" | "canceled";
  receiptUrl?: string | null;
}) {
  const updatedAt = new Date().toISOString();

  const orderUpdate: {
    status: "pending" | "paid" | "refunded" | "canceled";
    updated_at: string;
    receipt_url?: string | null;
  } = {
    status: args.orderStatus,
    updated_at: updatedAt,
  };
  if (args.receiptUrl) {
    orderUpdate.receipt_url = args.receiptUrl;
  }

  const { data: orderRows, error: orderError } = await supabaseAdmin
    .from("orders")
    .update(orderUpdate)
    .eq("provider", "stripe")
    .eq("provider_checkout_session_id", args.checkoutSessionId)
    .select("id");

  if (orderError) {
    if (isMissingRelationError(orderError.message)) return;
    throw new Error(orderError.message);
  }

  const orderIds = (orderRows ?? []).map((row) => row.id);
  if (orderIds.length === 0) {
    return;
  }

  const { error: purchaseError } = await supabaseAdmin
    .from("bundle_purchases")
    .update({
      purchase_status: args.purchaseStatus,
      updated_at: updatedAt,
    })
    .in("order_id", orderIds);

  if (purchaseError) {
    if (isMissingRelationError(purchaseError.message)) return;
    throw new Error(purchaseError.message);
  }
}

async function markBundleOrderAndPurchaseRefundedByInvoiceId(invoiceId: string) {
  const updatedAt = new Date().toISOString();
  const { data: purchaseRows, error: purchaseLookupError } = await supabaseAdmin
    .from("bundle_purchases")
    .select("id,order_id")
    .eq("provider", "stripe")
    .eq("provider_invoice_id", invoiceId);

  if (purchaseLookupError) {
    if (isMissingRelationError(purchaseLookupError.message)) return;
    throw new Error(purchaseLookupError.message);
  }

  const purchaseIds = (purchaseRows ?? []).map((row) => row.id);
  const orderIds = (purchaseRows ?? []).map((row) => row.order_id);

  if (purchaseIds.length > 0) {
    const { error: purchaseUpdateError } = await supabaseAdmin
      .from("bundle_purchases")
      .update({
        purchase_status: "refunded",
        updated_at: updatedAt,
      })
      .in("id", purchaseIds);
    if (purchaseUpdateError) {
      if (isMissingRelationError(purchaseUpdateError.message)) return;
      throw new Error(purchaseUpdateError.message);
    }
  }

  if (orderIds.length > 0) {
    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "refunded",
        updated_at: updatedAt,
      })
      .in("id", orderIds);
    if (orderUpdateError) {
      if (isMissingRelationError(orderUpdateError.message)) return;
      throw new Error(orderUpdateError.message);
    }
  }
}

async function processBundleCheckoutSessionCompleted(args: {
  stripe: Stripe;
  eventId: string;
  session: Stripe.Checkout.Session;
}) {
  const purchaseType = toLowerText(args.session.metadata?.purchase_type);
  if (args.session.mode !== "payment") return;
  if (purchaseType !== "web_plus_linket_bundle") return;

  const userId = await resolveUserIdForCheckoutSession(args.session, args.stripe);
  if (!userId) {
    console.warn(
      `Stripe webhook skipped checkout.session.completed: missing user_id for session ${args.session.id}`
    );
    return;
  }

  const createdAtIso = new Date(
    (args.session.created ?? Math.floor(Date.now() / 1000)) * 1000
  ).toISOString();
  const purchaserUserId = readUserIdFromMetadata(args.session.metadata) ?? userId;
  const customerId = readCheckoutCustomerId(args.session);
  const paymentIntentId = readCheckoutPaymentIntentId(args.session);
  const invoiceId = readCheckoutInvoiceId(args.session);
  const receiptUrl = await resolveReceiptUrlForCheckoutSession({
    stripe: args.stripe,
    invoiceId,
    paymentIntentId,
  });
  const shippingRateId = readCheckoutShippingRateId(args.session);
  const { shippingAddress, shippingName, shippingPhone } =
    await resolveCheckoutShippingDetails({
      stripe: args.stripe,
      session: args.session,
      customerId,
    });
  const orderStatus = mapCheckoutPaymentStatusToOrderStatus(
    args.session.payment_status
  );
  const purchaseStatus = mapCheckoutPaymentStatusToPurchaseStatus(
    args.session.payment_status
  );

  let quantity = 1;
  let bundlePriceId: string | null = null;
  try {
    const lineItems = await args.stripe.checkout.sessions.listLineItems(
      args.session.id,
      {
        limit: 10,
      }
    );
    const firstLine =
      lineItems.data.find((line) => (line.quantity ?? 0) > 0) ??
      lineItems.data[0] ??
      null;

    if (firstLine?.quantity && firstLine.quantity > 0) {
      quantity = firstLine.quantity;
    }
    bundlePriceId =
      (typeof firstLine?.price === "string"
        ? firstLine.price
        : firstLine?.price?.id) ?? null;
  } catch (error) {
    console.warn(
      `Stripe webhook line item lookup failed for bundle session ${args.session.id}`,
      error
    );
  }

  const metadata = {
    ...args.session.metadata,
    purchaser_user_id: purchaserUserId,
    event_id: args.eventId,
    checkout_status: args.session.status ?? null,
    checkout_payment_status: args.session.payment_status ?? null,
    checkout_mode: args.session.mode ?? null,
    entitlement_start: "linket_claim",
    entitlement_owner: "claimer_user",
    giftable: "true",
  };

  const { data: orderRow, error: orderError } = await supabaseAdmin
    .from("orders")
    .upsert(
      {
        user_id: userId,
        provider: "stripe",
        provider_checkout_session_id: args.session.id,
        provider_customer_id: customerId,
        status: orderStatus,
        currency: args.session.currency ?? "usd",
        subtotal_minor: args.session.amount_subtotal ?? 0,
        tax_minor: args.session.total_details?.amount_tax ?? 0,
        shipping_minor: args.session.total_details?.amount_shipping ?? 0,
        total_minor: args.session.amount_total ?? 0,
        receipt_url: receiptUrl,
        metadata,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "provider,provider_checkout_session_id",
      }
    )
    .select("id")
    .maybeSingle();

  if (orderError) {
    if (isMissingRelationError(orderError.message)) {
      console.warn(
        "Stripe webhook skipped orders upsert because table is unavailable."
      );
      return;
    }
    throw new Error(orderError.message);
  }

  if (!orderRow?.id) {
    console.warn(
      `Stripe webhook could not resolve persisted order row for checkout session ${args.session.id}`
    );
    return;
  }

  const { error: bundlePurchaseError } = await supabaseAdmin
    .from("bundle_purchases")
    .upsert(
      {
        order_id: orderRow.id,
        user_id: userId,
        provider: "stripe",
        provider_checkout_session_id: args.session.id,
        provider_customer_id: customerId,
        provider_payment_intent_id: paymentIntentId,
        provider_invoice_id: invoiceId,
        bundle_price_id: bundlePriceId,
        quantity,
        purchase_status: purchaseStatus,
        purchased_at: createdAtIso,
        shipping_rate_id: shippingRateId,
        shipping_name: shippingName,
        shipping_phone: shippingPhone,
        shipping_address: shippingAddress,
        metadata,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "provider,provider_checkout_session_id",
      }
    );

  if (bundlePurchaseError) {
    if (isMissingRelationError(bundlePurchaseError.message)) {
      console.warn(
        "Stripe webhook skipped bundle_purchases upsert because table is unavailable."
      );
      return;
    }
    throw new Error(bundlePurchaseError.message);
  }
}

function toSubscriptionEventSeverity(
  status: Stripe.Subscription.Status
): BillingEventSeverity {
  if (status === "unpaid" || status === "incomplete_expired") return "error";
  if (status === "past_due" || status === "incomplete" || status === "canceled") {
    return "warning";
  }
  return "info";
}

function toInvoiceFailureEventSeverity(invoice: Stripe.Invoice) {
  const compat = invoice as InvoiceCompat & {
    attempt_count?: number | null;
  };
  const attemptCount =
    typeof compat.attempt_count === "number" ? compat.attempt_count : 0;
  if (invoice.status === "uncollectible" || attemptCount >= 3) {
    return "error" as const;
  }
  return "warning" as const;
}

function getUnixFromStripeTimestamp(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(value);
}

async function upsertSubscriptionBillingEvent(args: {
  userId: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  eventType: string;
  sourceEventId: string;
  status: BillingEventSeverity;
  occurredAtUnix: number;
  metadata: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin
    .from("subscription_billing_events")
    .upsert(
      {
        user_id: args.userId,
        provider: "stripe",
        provider_customer_id: args.providerCustomerId,
        provider_subscription_id: args.providerSubscriptionId,
        event_type: args.eventType,
        source_event_id: args.sourceEventId,
        status: args.status,
        occurred_at: new Date(args.occurredAtUnix * 1000).toISOString(),
        metadata: args.metadata,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "provider,source_event_id",
      }
    );

  if (error) {
    if (isMissingRelationError(error.message)) {
      console.warn(
        "Stripe webhook skipped subscription_billing_events upsert because table is unavailable."
      );
      return;
    }
    throw new Error(error.message);
  }
}

async function processInvoicePaymentFailed(args: {
  stripe: Stripe;
  eventId: string;
  eventType: "invoice.payment_failed";
  eventCreated: number;
  invoice: Stripe.Invoice;
}) {
  const userId = await resolveUserIdForInvoice(args.invoice, args.stripe);
  if (!userId) {
    console.warn(
      `Stripe webhook skipped ${args.eventType}: missing user_id for invoice ${args.invoice.id}`
    );
    return;
  }

  const compat = args.invoice as InvoiceCompat & {
    attempt_count?: number | null;
    attempted?: boolean | null;
    next_payment_attempt?: number | null;
  };
  const subscriptionId = getSubscriptionId(args.invoice);
  const customerId = getCustomerId(args.invoice);

  await upsertSubscriptionBillingEvent({
    userId,
    providerCustomerId: customerId,
    providerSubscriptionId: subscriptionId,
    eventType: args.eventType,
    sourceEventId: args.eventId,
    status: toInvoiceFailureEventSeverity(args.invoice),
    occurredAtUnix: getUnixFromStripeTimestamp(args.eventCreated),
    metadata: {
      invoice_id: args.invoice.id,
      invoice_number: args.invoice.number ?? null,
      invoice_status: args.invoice.status ?? null,
      amount_due: args.invoice.amount_due ?? null,
      amount_paid: args.invoice.amount_paid ?? null,
      amount_remaining: args.invoice.amount_remaining ?? null,
      attempted:
        typeof compat.attempted === "boolean" ? compat.attempted : null,
      attempt_count:
        typeof compat.attempt_count === "number" ? compat.attempt_count : null,
      next_payment_attempt:
        typeof compat.next_payment_attempt === "number"
          ? compat.next_payment_attempt
          : null,
      collection_method: args.invoice.collection_method ?? null,
      hosted_invoice_url: args.invoice.hosted_invoice_url ?? null,
      payment_intent_id: getPaymentIntentIdFromInvoice(args.invoice),
      charge_id: getChargeIdFromInvoice(args.invoice),
    },
  });
}

async function processSubscriptionLifecycleEvent(args: {
  stripe: Stripe;
  eventId: string;
  eventType: "customer.subscription.updated" | "customer.subscription.deleted";
  eventCreated: number;
  subscription: Stripe.Subscription;
}) {
  const userId = await resolveUserIdForSubscription(args.subscription, args.stripe);
  if (!userId) {
    console.warn(
      `Stripe webhook skipped ${args.eventType}: missing user_id for subscription ${args.subscription.id}`
    );
    return;
  }

  const customerId = getCustomerIdFromSubscription(args.subscription);
  const firstItem = args.subscription.items.data[0];
  const firstPriceId =
    typeof firstItem?.price === "string"
      ? firstItem.price
      : firstItem?.price?.id ?? null;

  const severity =
    args.eventType === "customer.subscription.deleted"
      ? "warning"
      : toSubscriptionEventSeverity(args.subscription.status);

  if (args.eventType === "customer.subscription.updated") {
    try {
      const complimentaryWindow = await getLinketBundleComplimentaryWindowForUser(
        userId
      );
      if (complimentaryWindow.eligible) {
        await ensureNoChargeDuringComplimentary({
          stripe: args.stripe,
          subscriptionId: args.subscription.id,
          complimentaryStartsAt: complimentaryWindow.startsAt,
          complimentaryEndsAt: complimentaryWindow.endsAt,
          source: "stripe_webhook",
        });
      }
    } catch (error) {
      console.error(
        `Stripe webhook failed to enforce complimentary no-charge pause for subscription ${args.subscription.id}:`,
        error
      );
    }
  }

  await upsertSubscriptionBillingEvent({
    userId,
    providerCustomerId: customerId,
    providerSubscriptionId: args.subscription.id,
    eventType: args.eventType,
    sourceEventId: args.eventId,
    status: severity,
    occurredAtUnix: getUnixFromStripeTimestamp(args.eventCreated),
    metadata: {
      subscription_status: args.subscription.status,
      cancel_at_period_end: args.subscription.cancel_at_period_end,
      cancel_at: args.subscription.cancel_at ?? null,
      canceled_at: args.subscription.canceled_at ?? null,
      ended_at: args.subscription.ended_at ?? null,
      current_period_start: firstItem?.current_period_start ?? null,
      current_period_end: firstItem?.current_period_end ?? null,
      price_id: firstPriceId,
      collection_method: args.subscription.collection_method ?? null,
    },
  });
}

function buildEventMetadata(
  eventType: string,
  invoice: Stripe.Invoice,
  loyaltyEligible: boolean
) {
  return {
    event_type: eventType,
    invoice_id: invoice.id,
    invoice_number: invoice.number ?? null,
    invoice_status: invoice.status ?? null,
    amount_paid: invoice.amount_paid ?? null,
    amount_due: invoice.amount_due ?? null,
    currency: invoice.currency ?? null,
    loyalty_scope: loyaltyEligible ? "personal" : "excluded",
  };
}

async function upsertPaidPeriods(args: {
  userId: string;
  customerId: string | null;
  subscriptionId: string;
  eventId: string;
  metadata: Record<string, unknown>;
  periods: PeriodWindow[];
}) {
  for (const period of args.periods) {
    const { error } = await supabaseAdmin
      .from("subscription_billing_periods")
      .upsert(
        {
          user_id: args.userId,
          provider: "stripe",
          provider_customer_id: args.customerId,
          provider_subscription_id: args.subscriptionId,
          status: "paid",
          period_start: new Date(period.start * 1000).toISOString(),
          period_end: new Date(period.end * 1000).toISOString(),
          source_event_id: args.eventId,
          metadata: args.metadata,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict:
            "provider,provider_subscription_id,period_start,period_end,status",
        }
      );
    if (error) throw new Error(error.message);
  }
}

async function markPaidPeriodsWithStatus(args: {
  userId: string;
  customerId: string | null;
  subscriptionId: string;
  eventId: string;
  metadata: Record<string, unknown>;
  status: "refunded" | "voided";
  periods: PeriodWindow[];
}) {
  for (const period of args.periods) {
    const periodStartIso = new Date(period.start * 1000).toISOString();
    const periodEndIso = new Date(period.end * 1000).toISOString();

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from("subscription_billing_periods")
      .update({
        status: args.status,
        source_event_id: args.eventId,
        metadata: args.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", args.userId)
      .eq("provider", "stripe")
      .eq("provider_subscription_id", args.subscriptionId)
      .eq("period_start", periodStartIso)
      .eq("period_end", periodEndIso)
      .eq("status", "paid")
      .select("id");

    if (updateError) throw new Error(updateError.message);
    if ((updatedRows?.length ?? 0) > 0) continue;

    const { error: insertError } = await supabaseAdmin
      .from("subscription_billing_periods")
      .upsert(
        {
          user_id: args.userId,
          provider: "stripe",
          provider_customer_id: args.customerId,
          provider_subscription_id: args.subscriptionId,
          status: args.status,
          period_start: periodStartIso,
          period_end: periodEndIso,
          source_event_id: args.eventId,
          metadata: args.metadata,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict:
            "provider,provider_subscription_id,period_start,period_end,status",
        }
      );

    if (insertError) throw new Error(insertError.message);
  }
}

async function processInvoicePeriods(args: {
  stripe: Stripe;
  eventType: string;
  eventId: string;
  invoice: Stripe.Invoice;
}) {
  const subscriptionId = getSubscriptionId(args.invoice);
  if (!subscriptionId) return;

  const periods = collectInvoicePeriods(args.invoice);
  if (periods.length === 0) return;

  const userId = await resolveUserIdForInvoice(args.invoice, args.stripe);
  if (!userId) {
    console.warn(
      `Stripe webhook skipped ${args.eventType}: missing user_id for invoice ${args.invoice.id}`
    );
    return;
  }

  const customerId = getCustomerId(args.invoice);
  const personalProPriceIds = getPersonalProPriceIds();
  const loyaltyEligible = isInvoiceEligibleForPersonalLoyalty(
    args.invoice,
    personalProPriceIds
  );
  const complimentaryWindow =
    await getLinketBundleComplimentaryWindowForUser(userId);
  const metadata = {
    ...buildEventMetadata(
      args.eventType,
      args.invoice,
      loyaltyEligible
    ),
    complimentary_window_active: complimentaryWindow.active,
    complimentary_window_starts_at: complimentaryWindow.startsAt,
    complimentary_window_ends_at: complimentaryWindow.endsAt,
  };

  if (args.eventType === "invoice.voided") {
    await markPaidPeriodsWithStatus({
      userId,
      customerId,
      subscriptionId,
      eventId: args.eventId,
      metadata,
      status: "voided",
      periods,
    });
    return;
  }

  if (args.eventType === "charge.refunded") {
    await markPaidPeriodsWithStatus({
      userId,
      customerId,
      subscriptionId,
      eventId: args.eventId,
      metadata,
      status: "refunded",
      periods,
    });
    return;
  }

  if (!loyaltyEligible) return;

  const canApplyComplimentaryRefund = personalProPriceIds.size > 0;
  if (complimentaryWindow.active && !canApplyComplimentaryRefund) {
    console.warn(
      "Stripe webhook skipped complimentary refund because STRIPE_PERSONAL_PRO_PRICE_IDS is empty."
    );
  }

  const complimentaryInvoice =
    canApplyComplimentaryRefund &&
    complimentaryWindow.active &&
    isWithinComplimentaryWindow(
      periods,
      complimentaryWindow.startsAt,
      complimentaryWindow.endsAt
    );

  if (complimentaryInvoice) {
    await refundComplimentaryInvoiceIfNeeded({
      stripe: args.stripe,
      invoice: args.invoice,
      userId,
    });
    return;
  }

  await upsertPaidPeriods({
    userId,
    customerId,
    subscriptionId,
    eventId: args.eventId,
    metadata,
    periods,
  });
}

async function processInvoiceUpcoming(args: {
  stripe: Stripe;
  invoice: Stripe.Invoice;
}) {
  const subscriptionId = getSubscriptionId(args.invoice);
  if (!subscriptionId) return;

  const userId = await resolveUserIdForInvoice(args.invoice, args.stripe);
  if (!userId) return;

  const complimentaryWindow =
    await getLinketBundleComplimentaryWindowForUser(userId);
  if (!complimentaryWindow.eligible) return;

  await ensureNoChargeDuringComplimentary({
    stripe: args.stripe,
    subscriptionId,
    complimentaryStartsAt: complimentaryWindow.startsAt,
    complimentaryEndsAt: complimentaryWindow.endsAt,
    source: "stripe_webhook",
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json(
      { error: "Billing backend unavailable" },
      { status: 503 }
    );
  }

  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  const stripe = getStripeServerClient();
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await processBundleCheckoutSessionCompleted({
        stripe,
        eventId: event.id,
        session: event.data.object as Stripe.Checkout.Session,
      });
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await updateBundleOrderAndPurchaseStatusesBySession({
        checkoutSessionId: session.id,
        orderStatus: "canceled",
        purchaseStatus: "canceled",
      });
    } else if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_succeeded"
    ) {
      await processInvoicePeriods({
        stripe,
        eventType: event.type,
        eventId: event.id,
        invoice: event.data.object as Stripe.Invoice,
      });
    } else if (event.type === "invoice.upcoming") {
      await processInvoiceUpcoming({
        stripe,
        invoice: event.data.object as Stripe.Invoice,
      });
    } else if (event.type === "invoice.voided") {
      await processInvoicePeriods({
        stripe,
        eventType: event.type,
        eventId: event.id,
        invoice: event.data.object as Stripe.Invoice,
      });
    } else if (event.type === "invoice.payment_failed") {
      await processInvoicePaymentFailed({
        stripe,
        eventType: event.type,
        eventId: event.id,
        eventCreated: event.created,
        invoice: event.data.object as Stripe.Invoice,
      });
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as ChargeCompat;
      const isFullRefund =
        charge.refunded ||
        ((charge.amount_refunded ?? 0) >= Math.max(0, charge.amount ?? 0));
      if (!isFullRefund) {
        console.info(
          `Stripe webhook received partial refund for charge ${charge.id}; leaving billing periods in paid state.`
        );
        return NextResponse.json({ received: true, partialRefund: true });
      }

      const invoiceId =
        typeof charge.invoice === "string"
          ? charge.invoice
          : charge.invoice?.id;
      if (invoiceId) {
        await markBundleOrderAndPurchaseRefundedByInvoiceId(invoiceId);
        const invoice = await stripe.invoices.retrieve(invoiceId, {
          expand: ["customer", "subscription", "lines.data.price"],
        });
        await processInvoicePeriods({
          stripe,
          eventType: event.type,
          eventId: event.id,
          invoice,
        });
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await processSubscriptionLifecycleEvent({
        stripe,
        eventType: event.type,
        eventId: event.id,
        eventCreated: event.created,
        subscription: event.data.object as Stripe.Subscription,
      });
    }
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);
    return NextResponse.json(
      { error: "Unable to process webhook event" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
