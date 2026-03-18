import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { requireRouteAccess } from "@/lib/api-authorization";
import {
  ensureNoChargeDuringComplimentary,
  pickManageableSubscriptionId,
} from "@/lib/billing/complimentary-subscription";
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
  const access = await requireRouteAccess(
    request.method === "POST"
      ? "POST /api/billing/subscribe"
      : "GET /api/billing/subscribe"
  );
  const user = access instanceof NextResponse ? null : access.user;

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
    const complimentaryWindow =
      await getLinketBundleComplimentaryWindowForUser(user.id);
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });
    const manageableSubscriptionId = pickManageableSubscriptionId(
      existingSubscriptions.data
    );
    if (manageableSubscriptionId) {
      if (complimentaryWindow.eligible) {
        try {
          await ensureNoChargeDuringComplimentary({
            stripe,
            subscriptionId: manageableSubscriptionId,
            complimentaryStartsAt: complimentaryWindow.startsAt,
            complimentaryEndsAt: complimentaryWindow.endsAt,
            source: "billing_subscribe",
          });
        } catch (pauseError) {
          console.error(
            "Failed to enforce complimentary no-charge pause for existing subscription:",
            pauseError
          );
        }
      }

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

export async function GET(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return NextResponse.redirect(toBillingUrl("invalid_request_origin"), 303);
  }
  return handleSubscribe(request);
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return NextResponse.redirect(toBillingUrl("invalid_request_origin"), 303);
  }
  return handleSubscribe(request);
}
