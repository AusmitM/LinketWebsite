import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { constructWebhookEvent } from "@/lib/billing/stripe";
import {
  createWebhookEventRecord,
  handleChargeRefunded,
  markBundleCheckoutExpired,
  markInvoicePaid,
  markInvoicePaymentFailed,
  markWebhookEventFailed,
  markWebhookEventProcessed,
  recordBundleCheckoutSession,
  upsertSubscriptionFromStripe,
} from "@/lib/billing/entitlements";

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

async function processStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await recordBundleCheckoutSession(session);
      return;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.id) {
        await markBundleCheckoutExpired(session.id);
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertSubscriptionFromStripe(subscription);
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await markInvoicePaid(invoice);
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (subscriptionId) {
        await markInvoicePaymentFailed(subscriptionId);
      }
      return;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (typeof charge.payment_intent === "string") {
        await handleChargeRefunded(charge.payment_intent);
      }
      return;
    }
    default:
      return;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const existing = await createWebhookEventRecord(event);
    if (existing.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await processStripeEvent(event);
    await markWebhookEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed.";
    await markWebhookEventFailed(event.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
