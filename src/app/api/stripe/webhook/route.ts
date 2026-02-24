import { NextResponse } from "next/server";
import Stripe from "stripe";

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
  const metadata = buildEventMetadata(
    args.eventType,
    args.invoice,
    loyaltyEligible
  );

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
    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
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
