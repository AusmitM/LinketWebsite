import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";

import { requireRouteAccess } from "@/lib/api-authorization";
import { isManageableStripeSubscriptionStatus } from "@/lib/billing/complimentary-subscription";
import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { isTrustedRequestOrigin } from "@/lib/http-origin";
import { validateJsonBody } from "@/lib/request-validation";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";

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

  const access = await requireRouteAccess("POST /api/billing/payment-method/remove");
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
      limit: 50,
    });
    const replacementPaymentMethodId =
      paymentMethodList.data.find((method) => method.id !== paymentMethodId)?.id ??
      null;

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 50,
    });

    const hasManageableSubscription = subscriptions.data.some((subscription) =>
      isManageableStripeSubscriptionStatus(subscription.status)
    );

    if (!replacementPaymentMethodId && hasManageableSubscription) {
      return NextResponse.json(
        {
          error:
            "Add another payment method before removing your only card while subscription billing is active.",
        },
        { status: 400 }
      );
    }

    if (currentCustomerDefaultPaymentMethodId === paymentMethodId) {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: replacementPaymentMethodId ?? undefined,
        },
      });
    }

    await Promise.all(
      subscriptions.data
        .filter((subscription) =>
          isManageableStripeSubscriptionStatus(subscription.status)
        )
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
