import "server-only";

import Stripe from "stripe";

import { getConfiguredSiteOrigin } from "@/lib/site-url";
import { getStripePriceId } from "@/lib/billing/plans";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import type { BillingSource, CheckoutPlanKey } from "@/types/billing";

type CheckoutSessionInput = {
  userId: string;
  userEmail: string | null;
  planKey: CheckoutPlanKey;
  source: BillingSource;
  discountEligibleForPro?: boolean;
};

let stripeClient: Stripe | null = null;

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

async function getStripeCustomerIdForUser(userId: string) {
  if (!isSupabaseAdminAvailable) return null;
  const { data, error } = await supabaseAdmin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }

  return data?.stripe_customer_id ?? null;
}

export async function getOrCreateStripeCustomer(params: {
  userId: string;
  email: string | null;
}) {
  const existing = await getStripeCustomerIdForUser(params.userId);
  if (existing) return existing;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: params.email ?? undefined,
    metadata: { userId: params.userId },
  });

  if (isSupabaseAdminAvailable) {
    const { error } = await supabaseAdmin.from("billing_customers").upsert(
      {
        user_id: params.userId,
        stripe_customer_id: customer.id,
        email: params.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error && !isMissingRelationError(error)) {
      throw new Error(error.message);
    }
  }

  return customer.id;
}

function getRequiredShippingRate(varName: string) {
  const value = process.env[varName]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${varName}.`);
  }
  return value;
}

export async function createCheckoutSession(input: CheckoutSessionInput) {
  const stripe = getStripeClient();
  const customerId = await getOrCreateStripeCustomer({
    userId: input.userId,
    email: input.userEmail,
  });
  const priceId = getStripePriceId(input.planKey, {
    discountEligibleForPro: input.discountEligibleForPro,
  });
  const siteOrigin = getConfiguredSiteOrigin();
  const successUrl = `${siteOrigin}/dashboard/billing?checkout=success`;
  const cancelUrl = `${siteOrigin}/dashboard/billing?checkout=cancelled`;

  const metadata = {
    userId: input.userId,
    planKey: input.planKey,
    source: input.source,
  };

  if (input.planKey === "bundle_59") {
    const standardShipping = getRequiredShippingRate("STRIPE_SHIPPING_RATE_STANDARD");
    const expeditedShipping = getRequiredShippingRate("STRIPE_SHIPPING_RATE_EXPEDITED");

    return stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: input.userId,
      allow_promotion_codes: false,
      automatic_tax: { enabled: true },
      shipping_address_collection: { allowed_countries: ["US"] },
      phone_number_collection: { enabled: true },
      shipping_options: [
        { shipping_rate: standardShipping },
        { shipping_rate: expeditedShipping },
      ],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      payment_intent_data: { metadata },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: input.userId,
    allow_promotion_codes: false,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function createBillingPortalSession(params: {
  userId: string;
  userEmail: string | null;
}) {
  const stripe = getStripeClient();
  const customerId = await getOrCreateStripeCustomer({
    userId: params.userId,
    email: params.userEmail,
  });
  const returnUrl = `${getConfiguredSiteOrigin()}/dashboard/billing`;

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export function constructWebhookEvent(payload: string, signature: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  }
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
