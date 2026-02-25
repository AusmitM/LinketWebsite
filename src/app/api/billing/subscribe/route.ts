import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { getLinketBundleComplimentaryWindowForUser } from "@/lib/billing/linket-bundle";
import { isTrustedRequestOrigin } from "@/lib/http-origin";
import { getConfiguredSiteOrigin } from "@/lib/site-url";
import {
  getPersonalProPriceIdForInterval,
  getStripeSecretKey,
  getStripeServerClient,
  type BillingInterval,
} from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toBillingUrl(errorCode?: string) {
  const base = getConfiguredSiteOrigin().replace(/\/$/, "");
  if (!errorCode) return `${base}/dashboard/billing`;
  return `${base}/dashboard/billing?billingError=${encodeURIComponent(errorCode)}`;
}

function toInterval(value: string | null): BillingInterval {
  return value === "year" ? "year" : "month";
}

function toSuccessUrl() {
  const base = getConfiguredSiteOrigin().replace(/\/$/, "");
  return `${base}/dashboard/billing?checkout=success`;
}

function toCancelUrl() {
  const base = getConfiguredSiteOrigin().replace(/\/$/, "");
  return `${base}/dashboard/billing?checkout=cancel`;
}

function pickManageableSubscriptionId(
  subscriptions: Stripe.Subscription[]
) {
  const priority = ["trialing", "active", "past_due", "unpaid", "paused"] as const;
  for (const status of priority) {
    const match = subscriptions.find((subscription) => subscription.status === status);
    if (match) return match.id;
  }
  return null;
}

function buildCheckoutIdempotencyKey(args: {
  userId: string;
  interval: BillingInterval;
  priceId: string;
}) {
  const slot = Math.floor(Date.now() / 30_000);
  return `billing-subscribe:${args.userId}:${args.interval}:${args.priceId}:${slot}`;
}

async function handleSubscribe(request: NextRequest) {
  const interval = toInterval(request.nextUrl.searchParams.get("interval"));

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const base = getConfiguredSiteOrigin().replace(/\/$/, "");
    const billingUrl = new URL(`${base}/dashboard/billing`);
    billingUrl.searchParams.set(
      "intent",
      interval === "year" ? "pro_yearly" : "pro_monthly"
    );
    billingUrl.searchParams.set("resume", "subscribe");
    const nextPath = `${billingUrl.pathname}${billingUrl.search}`;
    return NextResponse.redirect(
      `${base}/auth?view=signin&next=${encodeURIComponent(nextPath)}`,
      303
    );
  }

  if (!getStripeSecretKey()) {
    return NextResponse.redirect(toBillingUrl("stripe_unavailable"), 303);
  }

  const priceId = getPersonalProPriceIdForInterval(interval);
  if (!priceId) {
    return NextResponse.redirect(toBillingUrl("missing_price_configuration"), 303);
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
    return NextResponse.redirect(toBillingUrl("no_customer"), 303);
  }

  try {
    const stripe = getStripeServerClient();
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });
    const manageableSubscriptionId = pickManageableSubscriptionId(
      existingSubscriptions.data
    );
    if (manageableSubscriptionId) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: toBillingUrl(),
        flow_data: {
          type: "subscription_update",
          subscription_update: {
            subscription: manageableSubscriptionId,
          },
        },
      });
      return NextResponse.redirect(portalSession.url, 303);
    }

    const complimentaryWindow =
      await getLinketBundleComplimentaryWindowForUser(user.id);
    const trialEndMs =
      complimentaryWindow.active && complimentaryWindow.endsAt
        ? new Date(complimentaryWindow.endsAt).getTime()
        : null;
    const trialEndUnix =
      trialEndMs && Number.isFinite(trialEndMs)
        ? Math.floor(trialEndMs / 1000)
        : null;
    const nowUnix = Math.floor(Date.now() / 1000);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      allow_promotion_codes: true,
      success_url: toSuccessUrl(),
      cancel_url: toCancelUrl(),
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
        plan_scope: "personal",
        price_interval: interval,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          supabase_user_id: user.id,
          plan_scope: "personal",
          loyalty_scope: "personal",
          complimentary_source: complimentaryWindow.active
            ? "linket_claim"
            : "none",
        },
        ...(trialEndUnix && trialEndUnix > nowUnix + 60
          ? { trial_end: trialEndUnix }
          : {}),
      },
    }, {
      idempotencyKey: buildCheckoutIdempotencyKey({
        userId: user.id,
        interval,
        priceId,
      }),
    });

    if (!checkoutSession.url) {
      return NextResponse.redirect(toBillingUrl("checkout_unavailable"), 303);
    }

    return NextResponse.redirect(checkoutSession.url, 303);
  } catch (error) {
    console.error("Stripe subscription checkout session creation failed:", error);
    return NextResponse.redirect(toBillingUrl("checkout_unavailable"), 303);
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  return handleSubscribe(request);
}
