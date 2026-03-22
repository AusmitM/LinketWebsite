import type { ReactNode } from "react";
import Link from "next/link";

import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PricingTier {
  name: string;
  icon: ReactNode;
  price: number | string;
  description: string;
  features: string[];
  popular?: boolean;
  color: string;
  billingLabel?: string;
  audience?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
}

function CreativePricing({
  tag = "Linket plans",
  title = "Tap-ready kits for every crew",
  description = "Choose the plan that keeps intros warm - from solo sellers to full go-to-market teams.",
  controls,
  theme = "warm",
  tiers,
}: {
  tag?: string;
  title?: string;
  description?: string;
  controls?: ReactNode;
  theme?: "warm" | "business";
  tiers: PricingTier[];
}) {
  const useTwoColumnLayout = tiers.length === 2;
  const businessTheme = theme === "business";

  return (
    <div
      className={cn(
        "w-full rounded-[28px] p-5 sm:rounded-[40px] sm:p-8 md:p-12",
        businessTheme
          ? "bg-gradient-to-br from-[#edf6ff] via-[#f7fbff] to-[#e2efff] shadow-[0_40px_120px_rgba(59,130,246,0.22)]"
          : "bg-gradient-to-br from-[#fff7ed] via-white to-[#e8f7ff] shadow-[0_40px_120px_rgba(255,151,118,0.25)]"
      )}
    >
      <div className="text-center">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] sm:px-4 sm:text-xs sm:tracking-[0.35em]",
            businessTheme
              ? "border border-[#c5dcff] text-[#1d4ed8]"
              : "border border-[#ffd7c0] text-[#b45309]"
          )}
        >
          {tag}
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-sm text-slate-600 sm:text-base">{description}</p>
        {controls && <div className="mt-5 flex justify-center">{controls}</div>}
      </div>

      <div
        className={cn(
          "mt-8 grid gap-5 sm:mt-12 sm:gap-6",
          useTwoColumnLayout
            ? "md:mx-auto md:max-w-5xl md:grid-cols-2"
            : "md:grid-cols-3"
        )}
      >
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              "relative flex flex-col gap-5 rounded-[28px] border bg-white/90 p-5 shadow-[0_25px_90px_rgba(15,23,42,0.12)] backdrop-blur sm:gap-6 sm:rounded-[32px] sm:p-6",
              businessTheme ? "border-[#d2e3ff]" : "border-[#ffe4d6]",
              tier.popular &&
                (businessTheme
                  ? "border-[#4f8ff7] bg-gradient-to-b from-white to-[#eef5ff]"
                  : "border-[#ff9776] bg-gradient-to-b from-white to-[#fff2ea]")
            )}
          >
            {tier.popular && (
              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-0 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold shadow-lg sm:text-xs",
                  businessTheme
                    ? "border-[#bfdbfe] bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] text-white shadow-[0_10px_25px_rgba(37,99,235,0.35)]"
                    : "border-[#ffd7c0] bg-gradient-to-r from-[#f97316] via-[#fb923c] to-[#fdba74] text-[#0f172a] shadow-[0_10px_25px_rgba(249,115,22,0.35)]"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Most popular
              </div>
            )}
            <div className="flex items-start gap-3 pt-1 sm:items-center sm:gap-4 sm:pt-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff9776] via-[#ffd27f] to-[#7dd3fc] text-[#0f172a]">
                {tier.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-700 sm:text-xs sm:tracking-[0.35em]">
                  {tier.description}
                </p>
                <h3 className="text-lg font-semibold text-[#0f172a] sm:text-xl">
                  {tier.name}
                </h3>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                You pay
              </p>
              <p className="text-3xl font-semibold text-[#0f172a] sm:text-4xl">
                {typeof tier.price === "number" ? `$${tier.price}` : tier.price}
              </p>
              <p className="text-sm text-slate-600">
                {tier.billingLabel ?? "every month"}
              </p>
            </div>

            <ul className="space-y-3 text-sm text-slate-600">
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border px-3 py-2 text-[#0f172a]",
                    businessTheme
                      ? "border-[#d6e6ff] bg-[#f4f9ff]"
                      : "border-[#ffe4d6] bg-[#fff8f3]"
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      businessTheme ? "text-[#3b82f6]" : "text-[#ff9776]"
                    )}
                    aria-hidden
                  />
                  {feature}
                </li>
              ))}
            </ul>

            {tier.ctaHref ? (
              <div
                className={cn(
                  "grid gap-2",
                  tier.secondaryCtaHref ? "sm:grid-cols-2" : "sm:grid-cols-1"
                )}
              >
                <Button
                  asChild
                  variant={businessTheme ? "custom" : "landingPrimary"}
                  className={cn(
                    "w-full rounded-2xl text-base font-semibold transition hover:-translate-y-0.5",
                    businessTheme
                      ? "border border-[#cfe0ff] bg-white text-[#0f172a]"
                      : "",
                    tier.popular &&
                      (businessTheme
                        ? "border-transparent bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] text-white shadow-[0_18px_45px_rgba(37,99,235,0.35)]"
                        : "shadow-[0_18px_45px_rgba(255,151,118,0.35)]")
                  )}
                >
                  <Link
                    href={tier.ctaHref}
                    data-analytics-id="pricing_cta_click"
                    data-analytics-meta={JSON.stringify({
                      section: "landing_pricing",
                      tier: tier.name,
                      price: tier.price,
                      href: tier.ctaHref,
                      billing_interval: "month_or_default",
                    })}
                  >
                    {tier.ctaLabel ?? "Choose this option"}
                  </Link>
                </Button>
                {tier.secondaryCtaHref ? (
                  <Button
                    asChild
                    variant={businessTheme ? "custom" : "landingSecondary"}
                    className={cn(
                      "w-full rounded-2xl text-base font-semibold transition hover:-translate-y-0.5",
                      businessTheme
                        ? "border border-[#cfe0ff] bg-white text-[#1e3a8a]"
                        : ""
                    )}
                  >
                    <Link
                      href={tier.secondaryCtaHref}
                      data-analytics-id="pricing_cta_click"
                      data-analytics-meta={JSON.stringify({
                        section: "landing_pricing",
                        tier: tier.name,
                        price: tier.price,
                        href: tier.secondaryCtaHref,
                        billing_interval: "year",
                      })}
                    >
                      {tier.secondaryCtaLabel ?? "Yearly"}
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <Button
                type="button"
                variant={businessTheme ? "custom" : "landingSecondary"}
                disabled
                data-analytics-id="pricing_cta_click"
                data-analytics-meta={JSON.stringify({
                  section: "landing_pricing",
                  tier: tier.name,
                  price: tier.price,
                  disabled: true,
                })}
                className={cn(
                  "w-full rounded-2xl text-base font-semibold",
                  businessTheme ? "border border-[#cfe0ff] bg-white text-[#0f172a]" : ""
                )}
              >
                {tier.ctaLabel ?? "Choose this option"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export { CreativePricing };
