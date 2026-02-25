import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { isTrustedRequestOrigin } from "@/lib/http-origin";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  paymentMethodId?: string;
};

function sanitizePaymentMethodId(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (!trimmed.startsWith("pm_")) return null;
  return trimmed;
}

function readPaymentMethodId(
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

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
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

  const payload = (await request.json().catch(() => null)) as Payload | null;
  const paymentMethodId = sanitizePaymentMethodId(payload?.paymentMethodId);
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

    const customerResponse = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if ("deleted" in customerResponse && customerResponse.deleted) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    const customer = customerResponse as Stripe.Customer;

    const currentCustomerDefaultPaymentMethodId = readPaymentMethodId(
      customer.invoice_settings.default_payment_method
    );

    const paymentMethodList = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 20,
    });
    const replacementPaymentMethodId =
      paymentMethodList.data.find((method) => method.id !== paymentMethodId)?.id ??
      null;

    if (currentCustomerDefaultPaymentMethodId === paymentMethodId) {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: replacementPaymentMethodId ?? undefined,
        },
      });
    }

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
        .filter(
          (subscription) =>
            readPaymentMethodId(subscription.default_payment_method) ===
            paymentMethodId
        )
        .map((subscription) =>
          stripe.subscriptions.update(subscription.id, {
            default_payment_method: replacementPaymentMethodId ?? undefined,
          })
        )
    );

    await stripe.paymentMethods.detach(paymentMethodId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Stripe payment method removal failed:", error);
    return NextResponse.json({ error: "Unable to remove card" }, { status: 500 });
  }
}
