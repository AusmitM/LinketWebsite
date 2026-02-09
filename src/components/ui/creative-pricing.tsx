import type { ReactNode } from "react";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PricingTier {
  name: string;
  icon: ReactNode;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  color: string;
}

function CreativePricing({
  tag = "Linket plans",
  title = "Tap-ready kits for every crew",
  description = "Choose the plan that keeps intros warm - from solo sellers to full go-to-market teams.",
  tiers,
}: {
  tag?: string;
  title?: string;
  description?: string;
  tiers: PricingTier[];
}) {
  return (
    <div className="w-full rounded-[28px] bg-gradient-to-br from-[#fff7ed] via-white to-[#e8f7ff] p-5 shadow-[0_40px_120px_rgba(255,151,118,0.25)] sm:rounded-[40px] sm:p-8 md:p-12">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ffd7c0] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b45309] sm:px-4 sm:text-xs sm:tracking-[0.35em]">
          {tag}
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-sm text-slate-600 sm:text-base">{description}</p>
      </div>

      <div className="mt-8 grid gap-5 sm:mt-12 sm:gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              "relative flex flex-col gap-5 rounded-[28px] border border-[#ffe4d6] bg-white/90 p-5 shadow-[0_25px_90px_rgba(15,23,42,0.12)] backdrop-blur sm:gap-6 sm:rounded-[32px] sm:p-6",
              tier.popular &&
                "border-[#ff9776] bg-gradient-to-b from-white to-[#fff2ea]"
            )}
          >
            {tier.popular && (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#ff9776]/15 px-3 py-1 text-[11px] font-semibold text-[#b45309] sm:text-xs">
                Most popular
              </span>
            )}
            <div className="flex items-start gap-3 pt-1 sm:items-center sm:gap-4 sm:pt-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff9776] via-[#ffd27f] to-[#7dd3fc] text-white">
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
              <p className="text-3xl font-semibold text-[#0f172a] sm:text-4xl">
                ${tier.price}
              </p>
              <p className="text-sm text-slate-600">per month</p>
            </div>

            <ul className="space-y-3 text-sm text-slate-600">
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 rounded-2xl border border-[#ffe4d6] bg-[#fff8f3] px-3 py-2 text-[#0f172a]"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9776]" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>

            <Button
              data-analytics-id="pricing_cta_click"
              data-analytics-meta={JSON.stringify({
                section: "landing_pricing",
                tier: tier.name,
                price: tier.price,
              })}
              className={cn(
                "w-full rounded-2xl border border-[#ffd7c0] bg-white text-base font-semibold text-[#0f172a] transition hover:-translate-y-0.5",
                tier.popular &&
                  "border-transparent bg-gradient-to-r from-[#ff9776] via-[#ffb866] to-[#5dd6f7] text-white shadow-[0_18px_45px_rgba(255,151,118,0.35)]"
              )}
            >
              Get started
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export { CreativePricing };
