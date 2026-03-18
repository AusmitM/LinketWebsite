import { NextRequest, NextResponse } from "next/server";

import { requireRouteAccess } from "@/lib/api-authorization";
import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { isTrustedRequestOrigin } from "@/lib/http-origin";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";
import { validateJsonBody } from "@/lib/request-validation";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  paymentMethodId?: string;
};

const paymentMethodBodySchema = z.object({
  paymentMethodId: z.string().trim().min(1).max(255),
});

function sanitizePaymentMethodId(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (!trimmed.startsWith("pm_")) return null;
  return trimmed;
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const access = await requireRouteAccess("POST /api/billing/payment-method/default");
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

  const parsedBody = await validateJsonBody(request, paymentMethodBodySchema);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const paymentMethodId = sanitizePaymentMethodId(
    (parsedBody.data as Payload).paymentMethodId
  );
  if (!paymentMethodId) {
    return NextResponse.json(
      { error: "Valid paymentMethodId is required" },
      { status: 400 }
    );
  }

  try {
    const customerId = await getOrCreateStripeCustomerForUser({
      userId: user.id,
      email: user.email ?? null,
      fullName:
        (user.user_metadata?.full_name as string | null | undefined) ??
        (user.user_metadata?.name as string | null | undefined) ??
        null,
      firstName:
        (user.user_metadata?.first_name as string | null | undefined) ?? null,
      lastName:
        (user.user_metadata?.last_name as string | null | undefined) ?? null,
    });
    if (!customerId) {
      return NextResponse.json(
        { error: "Unable to resolve billing customer" },
        { status: 500 }
      );
    }

    const stripe = getStripeServerClient();
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    const paymentMethodCustomerId =
      typeof paymentMethod.customer === "string"
        ? paymentMethod.customer
        : paymentMethod.customer?.id ?? null;

    if (paymentMethodCustomerId !== customerId) {
      return NextResponse.json(
        { error: "Payment method does not belong to this customer" },
        { status: 403 }
      );
    }

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
      metadata: {
        user_id: user.id,
        supabase_user_id: user.id,
      },
    });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });

    const updatableStatuses = new Set([
      "trialing",
      "active",
      "past_due",
      "unpaid",
      "incomplete",
      "paused",
    ]);

    await Promise.all(
      subscriptions.data
        .filter((subscription) => updatableStatuses.has(subscription.status))
        .map((subscription) =>
          stripe.subscriptions.update(subscription.id, {
            default_payment_method: paymentMethodId,
          })
        )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Stripe default payment method update failed:", error);
    return NextResponse.json(
      { error: "Unable to update default payment method" },
      { status: 500 }
    );
  }
}
