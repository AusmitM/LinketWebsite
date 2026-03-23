import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";

import { requireRouteAccess } from "@/lib/api-authorization";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";
import { validateSearchParams } from "@/lib/request-validation";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bundleSessionQuerySchema = z.object({
  session_id: z.string().trim().min(1).max(255),
});

type BundleSessionLifecycleStatus = "processing" | "paid" | "failed";
type PersistedOrderStatus = "pending" | "paid" | "refunded" | "canceled";
type PersistedPurchaseStatus = PersistedOrderStatus;

type PersistedOrderRow = {
  status: PersistedOrderStatus;
  receipt_url: string | null;
};

type PersistedBundlePurchaseRow = {
  purchase_status: PersistedPurchaseStatus;
};

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

function isMissingRelationError(message: string) {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("does not exist") ||
    lowered.includes("relation") ||
    lowered.includes("schema cache")
  );
}

async function readPersistedBundleSessionState(
  userId: string,
  checkoutSessionId: string
) {
  const supabase = await createServerSupabaseReadonly();
  try {
    const [orderResult, purchaseResult] = await Promise.all([
      supabase
        .from("orders")
        .select("status,receipt_url")
        .eq("provider", "stripe")
        .eq("user_id", userId)
        .eq("provider_checkout_session_id", checkoutSessionId)
        .maybeSingle<PersistedOrderRow>(),
      supabase
        .from("bundle_purchases")
        .select("purchase_status")
        .eq("provider", "stripe")
        .eq("user_id", userId)
        .eq("provider_checkout_session_id", checkoutSessionId)
        .maybeSingle<PersistedBundlePurchaseRow>(),
    ]);

    if (orderResult.error) throw orderResult.error;
    if (purchaseResult.error) throw purchaseResult.error;

    const orderStatus = orderResult.data?.status ?? null;
    const purchaseStatus = purchaseResult.data?.purchase_status ?? null;

    if (orderStatus === "paid" || purchaseStatus === "paid") {
      return {
        status: "paid" as const,
        receiptUrl: orderResult.data?.receipt_url ?? null,
      };
    }

    if (
      orderStatus === "canceled" ||
      purchaseStatus === "canceled" ||
      orderStatus === "refunded" ||
      purchaseStatus === "refunded"
    ) {
      return {
        status: "failed" as const,
        receiptUrl: orderResult.data?.receipt_url ?? null,
      };
    }

    if (orderStatus || purchaseStatus) {
      return {
        status: "processing" as const,
        receiptUrl: orderResult.data?.receipt_url ?? null,
      };
    }

    return null;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string" &&
      isMissingRelationError((error as { message: string }).message)
    ) {
      return null;
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const parsedQuery = validateSearchParams(
    request.nextUrl.searchParams,
    bundleSessionQuerySchema
  );
  if (!parsedQuery.ok) {
    return parsedQuery.response;
  }

  const checkoutSessionId = sanitizeCheckoutSessionId(parsedQuery.data.session_id);
  if (!checkoutSessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const access = await requireRouteAccess("GET /api/billing/bundle-session-status");
  if (access instanceof NextResponse) {
    return access;
  }
  const user = access.user;

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
    const persistedState = await readPersistedBundleSessionState(
      user.id,
      checkoutSessionId
    );
    const effectiveStatus: BundleSessionLifecycleStatus =
      persistedState?.status === "paid"
        ? "paid"
        : persistedState?.status === "failed"
          ? "failed"
          : lifecycleStatus === "paid"
            ? "processing"
            : lifecycleStatus;

    return NextResponse.json({
      status: effectiveStatus,
      checkoutStatus: checkoutSession.status ?? null,
      paymentStatus: checkoutSession.payment_status ?? null,
      paymentIntentStatus,
      receiptUrl:
        persistedState?.receiptUrl ??
        readReceiptUrlFromSessionInvoice(checkoutSession.invoice),
    });
  } catch (error) {
    console.error("Stripe bundle session status lookup failed:", error);
    return NextResponse.json(
      { error: "Unable to check bundle payment status" },
      { status: 500 }
    );
  }
}
