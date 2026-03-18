import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { requireRouteAccess } from "@/lib/api-authorization";
import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { isTrustedRequestOrigin } from "@/lib/http-origin";
import { getConfiguredSiteOrigin } from "@/lib/site-url";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toBillingUrl(errorCode?: string) {
  const base = getConfiguredSiteOrigin().replace(/\/$/, "");
  if (!errorCode) return `${base}/dashboard/billing`;
  return `${base}/dashboard/billing?billingError=${encodeURIComponent(errorCode)}`;
}

function toPortalFlow(
  value: string | null
): "plan" | null {
  if (value === "plan") return "plan";
  return null;
}

async function resolveActiveSubscriptionId(
  stripe: Stripe,
  customerId: string
) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });
  const priority: Array<Stripe.Subscription.Status> = [
    "trialing",
    "active",
    "past_due",
    "unpaid",
    "paused",
  ];
  for (const status of priority) {
    const match = subscriptions.data.find(
      (subscription) => subscription.status === status
    );
    if (match) return match.id;
  }
  return null;
}

function buildPortalIdempotencyKey(args: {
  customerId: string;
  flow: "plan" | null;
}) {
  const slot = Math.floor(Date.now() / 30_000);
  return `billing-portal:${args.customerId}:${args.flow ?? "default"}:${slot}`;
}

async function handlePortalSession(request: NextRequest) {
  const portalFlow = toPortalFlow(request.nextUrl.searchParams.get("flow"));
  const access = await requireRouteAccess(
    request.method === "POST"
      ? "POST /api/billing/portal"
      : "GET /api/billing/portal"
  );
  const user = access instanceof NextResponse ? null : access.user;

  if (!user) {
    const base = getConfiguredSiteOrigin().replace(/\/$/, "");
    const billingUrl = new URL(`${base}/dashboard/billing`);
    billingUrl.searchParams.set(
      "resume",
      portalFlow === "plan" ? "portal_plan" : "portal"
    );
    const nextPath = `${billingUrl.pathname}${billingUrl.search}`;
    return NextResponse.redirect(
      `${base}/auth?view=signin&next=${encodeURIComponent(nextPath)}`,
      303
    );
  }

  if (!getStripeSecretKey()) {
    return NextResponse.redirect(toBillingUrl("stripe_unavailable"), 303);
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
    const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: customerId,
      return_url: toBillingUrl(),
    };

    if (portalFlow === "plan") {
      const subscriptionId = await resolveActiveSubscriptionId(stripe, customerId);
      if (!subscriptionId) {
        const billingUrl = new URL(toBillingUrl());
        billingUrl.searchParams.set("intent", "pro_monthly");
        return NextResponse.redirect(billingUrl.toString(), 303);
      }
      sessionParams.flow_data = {
        type: "subscription_update",
        subscription_update: {
          subscription: subscriptionId,
        },
      };
    }

    const portalSession = await stripe.billingPortal.sessions.create(
      sessionParams,
      {
        idempotencyKey: buildPortalIdempotencyKey({
          customerId,
          flow: portalFlow,
        }),
      }
    );
    return NextResponse.redirect(portalSession.url, 303);
  } catch (error) {
    console.error("Stripe billing portal session creation failed:", error);
    return NextResponse.redirect(toBillingUrl("portal_unavailable"), 303);
  }
}

export async function GET(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return NextResponse.redirect(toBillingUrl("invalid_request_origin"), 303);
  }
  return handlePortalSession(request);
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return NextResponse.redirect(toBillingUrl("invalid_request_origin"), 303);
  }
  return handlePortalSession(request);
}
