import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { isTrustedRequestOrigin } from "@/lib/http-origin";
import { getConfiguredSiteOrigin } from "@/lib/site-url";
import {
  getLinketBundleAllowedShippingCountries,
  getLinketBundlePriceId,
  getLinketBundleShippingRateIds,
  getStripeSecretKey,
  getStripeServerClient,
} from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildShippingOptions() {
  const shippingRateIds = getLinketBundleShippingRateIds();
  return shippingRateIds.map(
    (shippingRateId): Stripe.Checkout.SessionCreateParams.ShippingOption => ({
      shipping_rate: shippingRateId,
    })
  );
}

function toBillingUrl(errorCode?: string) {
  const base = getConfiguredSiteOrigin().replace(/\/$/, "");
  if (!errorCode) return `${base}/dashboard/billing`;
  return `${base}/dashboard/billing?billingError=${encodeURIComponent(errorCode)}`;
}

function toSuccessUrl() {
  const base = getConfiguredSiteOrigin().replace(/\/$/, "");
  return `${base}/dashboard/billing?checkout=processing&purchase=bundle&session_id={CHECKOUT_SESSION_ID}`;
}

function toIncompleteUrl() {
  const base = getConfiguredSiteOrigin().replace(/\/$/, "");
  return `${base}/dashboard/billing?checkout=incomplete&purchase=bundle`;
}

function buildCheckoutIdempotencyKey(args: { userId: string; priceId: string }) {
  const slot = Math.floor(Date.now() / 30_000);
  return `billing-bundle:${args.userId}:${args.priceId}:${slot}`;
}

async function handleBundleCheckout(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const base = getConfiguredSiteOrigin().replace(/\/$/, "");
    const billingUrl = new URL(`${base}/dashboard/billing`);
    billingUrl.searchParams.set("intent", "bundle");
    billingUrl.searchParams.set("resume", "bundle_checkout");
    const nextPath = `${billingUrl.pathname}${billingUrl.search}`;
    return NextResponse.redirect(
      `${base}/auth?view=signin&next=${encodeURIComponent(nextPath)}`,
      303
    );
  }

  if (!getStripeSecretKey()) {
    return NextResponse.redirect(toBillingUrl("stripe_unavailable"), 303);
  }

  const priceId = getLinketBundlePriceId();
  if (!priceId) {
    return NextResponse.redirect(
      toBillingUrl("missing_bundle_price_configuration"),
      303
    );
  }
  const shippingOptions = buildShippingOptions();
  if (shippingOptions.length === 0) {
    return NextResponse.redirect(
      toBillingUrl("missing_bundle_shipping_configuration"),
      303
    );
  }
  const allowedCountries = getLinketBundleAllowedShippingCountries();

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
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      allow_promotion_codes: true,
      success_url: toSuccessUrl(),
      cancel_url: toIncompleteUrl(),
      line_items: [{ price: priceId, quantity: 1 }],
      automatic_tax: {
        enabled: true,
      },
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries:
          allowedCountries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
      },
      shipping_options: shippingOptions,
      phone_number_collection: {
        enabled: true,
      },
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        purchaser_user_id: user.id,
        plan_scope: "personal",
        purchase_type: "web_plus_linket_bundle",
        entitlement_start: "linket_claim",
        entitlement_owner: "claimer_user",
        giftable: "true",
      },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          metadata: {
            user_id: user.id,
            supabase_user_id: user.id,
            purchaser_user_id: user.id,
            plan_scope: "personal",
            purchase_type: "web_plus_linket_bundle",
            entitlement_owner: "claimer_user",
            giftable: "true",
          },
        },
      },
    }, {
      idempotencyKey: buildCheckoutIdempotencyKey({
        userId: user.id,
        priceId,
      }),
    });

    if (!checkoutSession.url) {
      return NextResponse.redirect(toBillingUrl("checkout_unavailable"), 303);
    }

    return NextResponse.redirect(checkoutSession.url, 303);
  } catch (error) {
    console.error("Stripe bundle checkout session creation failed:", error);
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
  return handleBundleCheckout(request);
}
