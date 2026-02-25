import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
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
  return `${base}/dashboard/billing?checkout=success&purchase=bundle`;
}

function toIncompleteUrl() {
  const base = getConfiguredSiteOrigin().replace(/\/$/, "");
  return `${base}/dashboard/billing?checkout=incomplete&purchase=bundle`;
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
        plan_scope: "personal",
        purchase_type: "web_plus_linket_bundle",
        entitlement_start: "linket_claim",
      },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          metadata: {
            user_id: user.id,
            supabase_user_id: user.id,
            plan_scope: "personal",
            purchase_type: "web_plus_linket_bundle",
          },
        },
      },
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
