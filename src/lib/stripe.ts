import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

export function getPersonalProPriceIds() {
  const raw = process.env.STRIPE_PERSONAL_PRO_PRICE_IDS?.trim();
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function getStripeServerClient() {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}
