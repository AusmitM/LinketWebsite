import { NextRequest, NextResponse } from "next/server";

import { requireRouteAccess } from "@/lib/api-authorization";
import { pickManageableSubscriptionId } from "@/lib/billing/complimentary-subscription";
import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { isTrustedRequestOrigin } from "@/lib/http-origin";
import { getConfiguredSiteOrigin } from "@/lib/site-url";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toBillingUrl(
  options?:
    | {
        errorCode?: string;
        subscriptionNotice?: "cancel_scheduled";
      }
    | undefined
) {
  const base = getConfiguredSiteOrigin().replace(/\/$/, "");
  const url = new URL(`${base}/dashboard/billing`);
  if (options?.errorCode) {
    url.searchParams.set("billingError", options.errorCode);
  }
  if (options?.subscriptionNotice) {
    url.searchParams.set("subscription", options.subscriptionNotice);
  }
  return url.toString();
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return NextResponse.redirect(
      toBillingUrl({ errorCode: "invalid_request_origin" }),
      303
    );
  }

  const access = await requireRouteAccess("POST /api/billing/subscription/cancel");
  const user = access instanceof NextResponse ? null : access.user;

  if (!user) {
    const base = getConfiguredSiteOrigin().replace(/\/$/, "");
    const nextPath = "/dashboard/billing";
    return NextResponse.redirect(
      `${base}/auth?view=signin&next=${encodeURIComponent(nextPath)}`,
      303
    );
  }

  if (!getStripeSecretKey()) {
    return NextResponse.redirect(
      toBillingUrl({ errorCode: "stripe_unavailable" }),
      303
    );
  }

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
    return NextResponse.redirect(toBillingUrl({ errorCode: "no_customer" }), 303);
  }

  try {
    const stripe = getStripeServerClient();
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });
    const subscriptionId = pickManageableSubscriptionId(subscriptions.data);
    if (!subscriptionId) {
      return NextResponse.redirect(
        toBillingUrl({ errorCode: "no_active_subscription" }),
        303
      );
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.status === "canceled" || subscription.cancel_at_period_end) {
      return NextResponse.redirect(
        toBillingUrl({ subscriptionNotice: "cancel_scheduled" }),
        303
      );
    }

    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
      metadata: {
        ...subscription.metadata,
        cancellation_requested_by: "self_service",
        cancellation_requested_at: new Date().toISOString(),
        user_id: user.id,
      },
    });

    return NextResponse.redirect(
      toBillingUrl({ subscriptionNotice: "cancel_scheduled" }),
      303
    );
  } catch (error) {
    console.error("Stripe subscription cancellation failed:", error);
    return NextResponse.redirect(
      toBillingUrl({ errorCode: "portal_unavailable" }),
      303
    );
  }
}
