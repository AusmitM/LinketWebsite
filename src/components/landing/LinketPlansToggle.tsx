"use client";

import { useMemo, useState } from "react";
import { Package, Pencil, Sparkles, Star } from "lucide-react";

import { CreativePricing } from "@/components/ui/creative-pricing";
import type { PricingTier } from "@/components/ui/creative-pricing";
import { cn } from "@/lib/utils";

type Audience = "individual" | "business";

const INDIVIDUAL_TIERS: PricingTier[] = [
  {
    name: "Free Web-Only",
    icon: <Pencil className="h-6 w-6" />,
    price: 0,
    billingLabel: "free + limited features",
    description: "Individual web-only starter",
    audience: "Individuals",
    color: "amber",
    features: [
      "Share one web profile and your core links",
      "No hardware required",
      "Best for trying Linket at no cost",
      "Upgrade anytime when you need more",
    ],
  },
  {
    name: "Web + Linket Bundle",
    icon: <Star className="h-6 w-6" />,
    price: 59,
    billingLabel: "$59 one-time, then optional Pro renewal after year 1",
    description: "Linket + 12 month pro access",
    audience: "Individuals",
    color: "blue",
    features: [
      "Get 1 standard Linket",
      "12 months of Paid Web-Only (Pro) included",
      "After year 1: keep Pro for $5/month or $50/year",
      "Best first purchase for one person",
    ],
    popular: true,
  },
  {
    name: "Paid Web-Only (Pro)",
    icon: <Pencil className="h-6 w-6" />,
    price: "$7/mo",
    billingLabel: "or $70/year",
    description: "Individual software plan",
    audience: "Individuals",
    color: "amber",
    features: [
      "Publish your profile and links with no hardware required",
      "Capture unlimited leads",
      "Remove Linket branding",
      "Pick monthly or yearly billing",
    ],
  },
];

const BUSINESS_TIERS: PricingTier[] = [
  {
    name: "Business Generic (min 5 units)",
    icon: <Package className="h-6 w-6" />,
    price: "$39/Linket",
    billingLabel: "one-time hardware purchase + $6/user/month",
    description: "Linket + Web-Platform",
    audience: "Businesses",
    color: "blue",
    features: [
      "Standard Linkets for your team",
      "Built for business rollout",
      "One-time hardware pricing",
      "Bulk pricing availible",
    ],
  },
  {
    name: "Custom Design Add-On (min 5 units)",
    icon: <Sparkles className="h-6 w-6" />,
    price: "$49-$69/Linket",
    billingLabel: "$499 custom design setup + $6/user/month",
    description: "Custom branded Linkets",
    audience: "Businesses",
    color: "amber",
    features: [
      "Consult with our 3D design specialists",
      "Custom branded designs",
      "Standard Linkets for your team",
      "Built for business rollout",
      "One-time hardware pricing",
      "Bulk pricing availible",
    ],
    popular: true,
  },
];

export default function LinketPlansToggle() {
  const [audience, setAudience] = useState<Audience>("individual");

  const { title, description, tiers, theme } = useMemo(() => {
    if (audience === "individual") {
      return {
        title: "Individual options",
        description:
          "Choose free web-only, paid web-only, or web + Linket bundle.",
        tiers: INDIVIDUAL_TIERS,
        theme: "warm" as const,
      };
    }

    return {
      title: "Business options",
      description:
        "Choose standard business Linkets or book a consult to customize a design.",
      tiers: BUSINESS_TIERS,
      theme: "business" as const,
    };
  }, [audience]);

  return (
    <CreativePricing
      tag="Linket plans"
      title={title}
      description={description}
      controls={
        <div className="relative grid grid-cols-2 rounded-full border border-[#ffd7c0] bg-white p-1">
          <span
            className={cn(
              "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full transition-all duration-300 ease-out",
              audience === "individual"
                ? "translate-x-0 bg-[#fff2e6] shadow-[0_6px_18px_rgba(180,83,9,0.18)]"
                : "translate-x-full bg-[#ecf6ff] shadow-[0_6px_18px_rgba(29,78,216,0.2)]"
            )}
            aria-hidden
          />
          <button
            type="button"
            onClick={() => setAudience("individual")}
            className={cn(
              "relative z-10 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-300 sm:text-sm",
              audience === "individual"
                ? "text-[#b45309]"
                : "text-slate-600 hover:text-slate-900"
            )}
            aria-pressed={audience === "individual"}
          >
            Individual
          </button>
          <button
            type="button"
            onClick={() => setAudience("business")}
            className={cn(
              "relative z-10 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-300 sm:text-sm",
              audience === "business"
                ? "text-[#1d4ed8]"
                : "text-slate-600 hover:text-slate-900"
            )}
            aria-pressed={audience === "business"}
          >
            Business
          </button>
        </div>
      }
      theme={theme}
      tiers={tiers}
    />
  );
}
