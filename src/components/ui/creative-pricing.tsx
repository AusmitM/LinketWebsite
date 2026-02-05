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
  description = "Choose the plan that keeps intros warm—from solo sellers to full go-to-market teams.",
  tiers,
}: {
  tag?: string;
  title?: string;
  description?: string;
  tiers: PricingTier[];
}) {
  return (
    <div className="w-full rounded-[40px] bg-gradient-to-br from-[#fff7ed] via-white to-[#e8f7ff] p-8 shadow-[0_40px_120px_rgba(255,151,118,0.25)] sm:p-12">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ffd7c0] bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#b45309]">
          {tag}
        </span>
        <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-[#0f172a] sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-base text-slate-600">{description}</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              "relative flex flex-col gap-6 rounded-[32px] border border-[#ffe4d6] bg-white/90 p-6 shadow-[0_25px_90px_rgba(15,23,42,0.12)] backdrop-blur",
              tier.popular &&
                "border-[#ff9776] bg-gradient-to-b from-white to-[#fff2ea]"
            )}
          >
            {tier.popular && (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#ff9776]/15 px-3 py-1 text-xs font-semibold text-[#b45309]">
                Most popular
              </span>
            )}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff9776] via-[#ffd27f] to-[#7dd3fc] text-white">
                {tier.icon}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-700">
                  {tier.description}
                </p>
                <h3 className="text-xl font-semibold text-[#0f172a]">
                  {tier.name}
                </h3>
              </div>
            </div>

            <div>
              <p className="text-4xl font-semibold text-[#0f172a]">
                ${tier.price}
              </p>
              <p className="text-sm text-slate-600">per month</p>
            </div>

            <ul className="space-y-3 text-sm text-slate-600">
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 rounded-2xl border border-[#ffe4d6] bg-[#fff8f3] px-3 py-2 text-[#0f172a]"
                >
                  <Check className="h-4 w-4 text-[#ff9776]" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>

            <Button
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
