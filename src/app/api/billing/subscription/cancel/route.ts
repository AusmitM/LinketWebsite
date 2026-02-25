import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { isTrustedRequestOrigin } from "@/lib/http-origin";
import { getConfiguredSiteOrigin } from "@/lib/site-url";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase/server";

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

function pickManageableSubscriptionId(subscriptions: Stripe.Subscription[]) {
  const priority = [
    "trialing",
    "active",
    "past_due",
    "unpaid",
    "incomplete",
    "paused",
  ] as const;
  for (const status of priority) {
    const match = subscriptions.find(
      (subscription) => subscription.status === status
    );
    if (match) return match.id;
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
    const base = getConfiguredSiteOrigin().replace(/\/$/, "");
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
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
