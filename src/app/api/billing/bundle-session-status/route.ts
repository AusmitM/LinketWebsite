import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BundleSessionLifecycleStatus = "processing" | "paid" | "failed";

function sanitizeCheckoutSessionId(value: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed.startsWith("cs_")) return null;
  return trimmed;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function readUserIdFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  if (!metadata) return null;
  const candidates = [
    metadata.user_id,
    metadata.userId,
    metadata.supabase_user_id,
    metadata.supabaseUserId,
    metadata.purchaser_user_id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (isUuid(trimmed)) return trimmed;
  }
  return null;
}

function deriveBundleLifecycleStatus(args: {
  checkoutStatus: Stripe.Checkout.Session.Status | null | undefined;
  paymentStatus: Stripe.Checkout.Session.PaymentStatus | null | undefined;
  paymentIntentStatus: Stripe.PaymentIntent.Status | null;
}) {
  if (args.paymentStatus === "paid" || args.paymentStatus === "no_payment_required") {
    return "paid" as const;
  }

  if (args.checkoutStatus === "expired") {
    return "failed" as const;
  }

  if (
    args.paymentIntentStatus === "canceled" ||
    args.paymentIntentStatus === "requires_payment_method"
  ) {
    return "failed" as const;
  }

  return "processing" as const;
}

function readReceiptUrlFromSessionInvoice(
  invoice:
    | string
    | Stripe.Invoice
    | null
    | undefined
) {
  if (!invoice || typeof invoice === "string") return null;
  return invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null;
}

export async function GET(request: NextRequest) {
  const checkoutSessionId = sanitizeCheckoutSessionId(
    request.nextUrl.searchParams.get("session_id")
  );
  if (!checkoutSessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getStripeSecretKey()) {
    return NextResponse.json(
      { error: "Billing backend unavailable" },
      { status: 503 }
    );
  }

  try {
    const stripe = getStripeServerClient();
    const checkoutSession = await stripe.checkout.sessions.retrieve(
      checkoutSessionId,
      {
        expand: ["payment_intent", "invoice"],
      }
    );

    const metadataUserId = readUserIdFromMetadata(checkoutSession.metadata ?? null);
    const clientReferenceUserId = checkoutSession.client_reference_id?.trim() ?? null;

    if (
      metadataUserId !== user.id &&
      clientReferenceUserId !== user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const paymentIntentStatus =
      checkoutSession.payment_intent &&
      typeof checkoutSession.payment_intent === "object"
        ? checkoutSession.payment_intent.status
        : null;

    const lifecycleStatus: BundleSessionLifecycleStatus = deriveBundleLifecycleStatus({
      checkoutStatus: checkoutSession.status,
      paymentStatus: checkoutSession.payment_status,
      paymentIntentStatus,
    });

    return NextResponse.json({
      status: lifecycleStatus,
      checkoutStatus: checkoutSession.status ?? null,
      paymentStatus: checkoutSession.payment_status ?? null,
      paymentIntentStatus,
      receiptUrl: readReceiptUrlFromSessionInvoice(checkoutSession.invoice),
    });
  } catch (error) {
    console.error("Stripe bundle session status lookup failed:", error);
    return NextResponse.json(
      { error: "Unable to check bundle payment status" },
      { status: 500 }
    );
  }
}
