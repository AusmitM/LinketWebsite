import { NextResponse } from "next/server";
import Stripe from "stripe";

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
  complimentaryEndsAt: string | null
) {
  if (!complimentaryEndsAt) return false;
  const endsAtMs = new Date(complimentaryEndsAt).getTime();
  if (!Number.isFinite(endsAtMs)) return false;
  return periods.length > 0 && periods.every((period) => period.start * 1000 < endsAtMs);
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
  const customerId = readCheckoutCustomerId(args.session);
  const paymentIntentId = readCheckoutPaymentIntentId(args.session);
  const invoiceId = readCheckoutInvoiceId(args.session);
  const shippingRateId = readCheckoutShippingRateId(args.session);
  const shippingAddress =
    args.session.collected_information?.shipping_details?.address ??
    args.session.customer_details?.address ??
    null;
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
    event_id: args.eventId,
    checkout_status: args.session.status ?? null,
    checkout_payment_status: args.session.payment_status ?? null,
    checkout_mode: args.session.mode ?? null,
    entitlement_start: "linket_claim",
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
        shipping_name:
          args.session.collected_information?.shipping_details?.name ??
          args.session.customer_details?.name ??
          null,
        shipping_phone: args.session.customer_details?.phone ?? null,
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
    isWithinComplimentaryWindow(periods, complimentaryWindow.endsAt);

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
    if (event.type === "checkout.session.completed") {
      await processBundleCheckoutSessionCompleted({
        stripe,
        eventId: event.id,
        session: event.data.object as Stripe.Checkout.Session,
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
    } else if (event.type === "invoice.voided") {
      await processInvoicePeriods({
        stripe,
        eventType: event.type,
        eventId: event.id,
        invoice: event.data.object as Stripe.Invoice,
      });
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as ChargeCompat;
      const invoiceId =
        typeof charge.invoice === "string"
          ? charge.invoice
          : charge.invoice?.id;
      if (invoiceId) {
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
