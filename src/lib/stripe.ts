import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export type BillingInterval = "month" | "year";

function parseCsvEnv(value: string | undefined | null) {
  if (!value) return [] as string[];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

export function getLinketBundlePriceId() {
  const direct =
    process.env.STRIPE_WEB_PLUS_LINKET_BUNDLE_PRICE_ID?.trim() ??
    process.env.STRIPE_LINKET_BUNDLE_PRICE_ID?.trim() ??
    "";
  return direct || null;
}

export function getLinketBundleShippingRateIds() {
  const direct = parseCsvEnv(
    process.env.STRIPE_LINKET_BUNDLE_SHIPPING_RATE_IDS?.trim()
  );
  if (direct.length > 0) return direct;

  const legacy = parseCsvEnv(
    [
      process.env.STRIPE_LINKET_BUNDLE_STANDARD_SHIPPING_RATE_ID,
      process.env.STRIPE_LINKET_BUNDLE_EXPRESS_SHIPPING_RATE_ID,
    ]
      .map((value) => value?.trim() ?? "")
      .filter(Boolean)
      .join(",")
  );
  return legacy;
}

export function getLinketBundleAllowedShippingCountries() {
  const countries = parseCsvEnv(
    process.env.STRIPE_LINKET_BUNDLE_ALLOWED_SHIPPING_COUNTRIES?.trim()
  ).map((country) => country.toUpperCase());
  return countries.length > 0 ? countries : ["US"];
}

function getPersonalProPriceIdList() {
  const raw = process.env.STRIPE_PERSONAL_PRO_PRICE_IDS?.trim();
  if (!raw) return [] as string[];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getPersonalProPriceIds() {
  return new Set(getPersonalProPriceIdList());
}

export function getPersonalProPriceIdForInterval(interval: BillingInterval) {
  const monthlyEnv = process.env.STRIPE_PERSONAL_PRO_MONTHLY_PRICE_ID?.trim();
  const yearlyEnv = process.env.STRIPE_PERSONAL_PRO_YEARLY_PRICE_ID?.trim();
  if (interval === "month" && monthlyEnv) return monthlyEnv;
  if (interval === "year" && yearlyEnv) return yearlyEnv;

  const fallback = getPersonalProPriceIdList();
  if (fallback.length === 0) return null;
  if (interval === "month") return fallback[0] ?? null;
  if (interval === "year") return fallback[1] ?? fallback[0] ?? null;
  return null;
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
