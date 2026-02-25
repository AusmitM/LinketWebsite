import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { getConfiguredSiteOrigin } from "@/lib/site-url";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase/server";

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
    "incomplete",
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

export async function GET(request: NextRequest) {
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
    const portalFlow = toPortalFlow(request.nextUrl.searchParams.get("flow"));
    const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: customerId,
      return_url: toBillingUrl(),
    };

    if (portalFlow === "plan") {
      const subscriptionId = await resolveActiveSubscriptionId(stripe, customerId);
      if (!subscriptionId) {
        const subscribeUrl = new URL("/api/billing/subscribe", request.url);
        subscribeUrl.searchParams.set("interval", "month");
        return NextResponse.redirect(subscribeUrl, 303);
      }
      sessionParams.flow_data = {
        type: "subscription_update",
        subscription_update: {
          subscription: subscriptionId,
        },
      };
    }

    const portalSession = await stripe.billingPortal.sessions.create(
      sessionParams
    );
    return NextResponse.redirect(portalSession.url, 303);
  } catch (error) {
    console.error("Stripe billing portal session creation failed:", error);
    return NextResponse.redirect(toBillingUrl("portal_unavailable"), 303);
  }
}
