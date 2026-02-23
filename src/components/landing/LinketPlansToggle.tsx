"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Pencil, Sparkles, Star } from "lucide-react";

import { CreativePricing } from "@/components/ui/creative-pricing";
import type { PricingTier } from "@/components/ui/creative-pricing";
import { toast } from "@/components/system/toaster";
import { BILLING_PLANS, isCheckoutPlanKey } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import type { CheckoutPlanKey } from "@/types/billing";

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
    ctaLabel: "Start for free",
    ctaHref: "/auth?view=signup",
  },
  {
    name: "Web + Linket Bundle",
    icon: <Star className="h-6 w-6" />,
    price: BILLING_PLANS.bundle_59.displayPrice,
    billingLabel: BILLING_PLANS.bundle_59.billingLabel,
    description: "Linket + 12 month pro access",
    audience: "Individuals",
    color: "blue",
    features: [
      "Get 1 standard Linket",
      "12 months of Paid Web-Only (Pro) included",
      "After year 1: keep Pro at $7/month or $70/year",
      "Discounted Pro ($5/$50) unlocks after 12 cumulative paid subscription months",
      "Best first purchase for one person",
    ],
    popular: true,
    planKey: "bundle_59",
    ctaLabel: "Buy bundle",
  },
  {
    name: "Paid Web-Only (Pro Monthly)",
    icon: <Pencil className="h-6 w-6" />,
    price: BILLING_PLANS.pro_monthly.displayPrice,
    billingLabel: BILLING_PLANS.pro_monthly.billingLabel,
    description: "Individual software plan",
    audience: "Individuals",
    color: "amber",
    features: [
      "Publish your profile and links with no hardware required",
      "Capture unlimited leads",
      "Remove Linket branding",
      "Loyalty discount unlocks after 12 cumulative paid subscription months",
      "Cancel anytime from billing portal",
    ],
    planKey: "pro_monthly",
    ctaLabel: "Start monthly",
  },
  {
    name: "Paid Web-Only (Pro Yearly)",
    icon: <Pencil className="h-6 w-6" />,
    price: BILLING_PLANS.pro_yearly.displayPrice,
    billingLabel: BILLING_PLANS.pro_yearly.billingLabel,
    description: "Individual software plan",
    audience: "Individuals",
    color: "amber",
    features: [
      "Same Pro feature set as monthly",
      "Capture unlimited leads",
      "Remove Linket branding",
      "Loyalty discount unlocks after 12 cumulative paid subscription months",
      "Best value for long-term use",
    ],
    planKey: "pro_yearly",
    ctaLabel: "Start yearly",
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
    ctaLabel: "Contact sales",
    ctaHref: "/#customization",
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
    ctaLabel: "Book consult",
    ctaHref: "/#customization",
  },
];

export default function LinketPlansToggle() {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>("individual");
  const [pendingPlan, setPendingPlan] = useState<CheckoutPlanKey | null>(null);

  const startCheckout = async (planKey: CheckoutPlanKey) => {
    setPendingPlan(planKey);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, source: "landing" }),
      });

      if (response.status === 401) {
        const next = `/dashboard/billing?checkout=${encodeURIComponent(planKey)}&source=landing`;
        setPendingPlan(null);
        router.push(`/auth?view=signin&next=${encodeURIComponent(next)}`);
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Unable to start checkout.");
      }
      window.location.assign(payload.url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start checkout.";
      toast({
        title: "Checkout unavailable",
        description: message,
        variant: "destructive",
      });
      setPendingPlan(null);
    }
  };

  const { title, description, tiers, theme } = useMemo(() => {
    const withPendingState = (items: PricingTier[]) =>
      items.map((item) => {
        const isPending =
          item.planKey && isCheckoutPlanKey(item.planKey)
            ? pendingPlan === item.planKey
            : false;
        return {
          ...item,
          disabled: isPending,
          pending: isPending,
        };
      });

    if (audience === "individual") {
      return {
        title: "Individual options",
        description:
          "Choose free web-only, paid web-only, or web + Linket bundle.",
        tiers: withPendingState(INDIVIDUAL_TIERS),
        theme: "warm" as const,
      };
    }

    return {
      title: "Business options",
      description:
        "Choose standard business Linkets or book a consult to customize a design.",
      tiers: withPendingState(BUSINESS_TIERS),
      theme: "business" as const,
    };
  }, [audience, pendingPlan]);

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
      onTierSelect={(tier) => {
        const maybePlanKey = tier.planKey;
        if (maybePlanKey && isCheckoutPlanKey(maybePlanKey)) {
          void startCheckout(maybePlanKey);
        }
      }}
    />
  );
}
