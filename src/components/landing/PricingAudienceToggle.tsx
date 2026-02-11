"use client";

import { useMemo, useState } from "react";
import { Building2, Package, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type IndividualPricingRow = {
  plan: string;
  monthly: string;
  yearly: string;
  oneTime: string;
  included: string;
  bestFor: string;
};

type BusinessPricingRow = {
  category: string;
  item: string;
  monthly: string;
  yearly: string;
  oneTime: string;
  notes: string;
};

type Props = {
  individualRows: IndividualPricingRow[];
  businessRows: BusinessPricingRow[];
};

type Audience = "individual" | "business";

function buildPaymentBadges({
  monthly,
  yearly,
  oneTime,
}: {
  monthly: string;
  yearly: string;
  oneTime: string;
}) {
  const badges: string[] = [];

  if (oneTime !== "N/A") {
    badges.push(`${oneTime} one-time`);
  }

  if (monthly !== "N/A") {
    badges.push(`${monthly} monthly`);
  }

  if (yearly !== "N/A") {
    badges.push(`${yearly} yearly`);
  }

  if (badges.length === 0) {
    badges.push("Contact sales");
  }

  return badges;
}

export default function PricingAudienceToggle({
  individualRows,
  businessRows,
}: Props) {
  const [audience, setAudience] = useState<Audience>("individual");

  const title = audience === "individual" ? "Individuals" : "Businesses";

  const summary =
    audience === "individual"
      ? "3 options: Free web-only, Paid web-only (Pro), or Web + Linket bundle."
      : "Software and hardware are sold separately. Custom design is optional and costs extra.";

  const visualCards = useMemo(() => {
    if (audience === "individual") {
      return [
        {
          key: "individual-free-web",
          title: "Free web-only",
          description: "No cost way to publish your profile and core links.",
          icon: <UserRound className="h-4 w-4" aria-hidden />,
          iconClassName: "bg-[#fff1e6] text-[#b45309]",
          cardClassName: "border-[#ffe6d7] bg-[#fffaf6]",
        },
        {
          key: "individual-paid-web",
          title: "Paid web-only (Pro)",
          description: "Monthly or yearly web plan with full software features.",
          icon: <Sparkles className="h-4 w-4" aria-hidden />,
          iconClassName: "bg-[#fff1e6] text-[#b45309]",
          cardClassName: "border-[#ffe6d7] bg-[#fffaf6]",
        },
        {
          key: "individual-web-plus-linket",
          title: "Web + Linket bundle",
          description: "One-time hardware purchase with paid web plan included for year one.",
          icon: <Package className="h-4 w-4" aria-hidden />,
          iconClassName: "bg-[#fff1e6] text-[#b45309]",
          cardClassName: "border-[#ffe6d7] bg-[#fffaf6]",
        },
      ];
    }

    return [
      {
        key: "business-software",
        title: "Team software seats",
        description: "Pay per teammate monthly or yearly for software access.",
        icon: <Building2 className="h-4 w-4" aria-hidden />,
        iconClassName: "bg-[#eaf4ff] text-[#1d4ed8]",
        cardClassName: "border-[#d9ecff] bg-[#f6fbff]",
      },
        {
          key: "business-hardware",
          title: "Hardware devices",
          description: "Buy physical Linket devices separately from software seats.",
          icon: <Package className="h-4 w-4" aria-hidden />,
          iconClassName: "bg-[#eaf4ff] text-[#1d4ed8]",
          cardClassName: "border-[#d9ecff] bg-[#f6fbff]",
        },
        {
          key: "business-custom-design",
          title: "Custom design add-on",
          description: "Optional branded device design. Paid extra on top of software and hardware.",
          icon: <Sparkles className="h-4 w-4" aria-hidden />,
          iconClassName: "bg-[#eaf4ff] text-[#1d4ed8]",
          cardClassName: "border-[#d9ecff] bg-[#f6fbff]",
        },
      ];
  }, [audience]);

  const cards = useMemo(() => {
    if (audience === "individual") {
      return individualRows.map((row) => ({
        id: row.plan,
        title: row.plan,
        context: `Best for: ${row.bestFor}`,
        paymentBadges: buildPaymentBadges(row),
        included: row.included,
      }));
    }

    return businessRows.map((row) => ({
      id: `${row.category}-${row.item}`,
      title: row.item,
      context: row.category,
      paymentBadges: buildPaymentBadges(row),
      included: row.notes,
    }));
  }, [audience, businessRows, individualRows]);

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-full border border-[#ffd7c0] bg-white p-1">
          <button
            type="button"
            onClick={() => setAudience("individual")}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition sm:text-sm",
              audience === "individual"
                ? "bg-[#fff2e6] text-[#b45309]"
                : "text-slate-600 hover:text-slate-900"
            )}
            aria-pressed={audience === "individual"}
          >
            Individuals
          </button>
          <button
            type="button"
            onClick={() => setAudience("business")}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition sm:text-sm",
              audience === "business"
                ? "bg-[#ecf6ff] text-[#1d4ed8]"
                : "text-slate-600 hover:text-slate-900"
            )}
            aria-pressed={audience === "business"}
          >
            Businesses
          </button>
        </div>
        <p className="max-w-xl text-sm text-slate-600">{summary}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {visualCards.map((card) => (
          <article
            key={card.key}
            className={cn("rounded-2xl border p-4", card.cardClassName)}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  card.iconClassName
                )}
              >
                {card.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                <p className="mt-1 text-xs text-slate-600">{card.description}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <article
        className={cn(
          "rounded-3xl border p-4 sm:p-5",
          audience === "individual"
            ? "border-[#ffe6d7] bg-[#fffaf6]"
            : "border-[#d9ecff] bg-[#f6fbff]"
        )}
      >
        <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
        <p className="mt-1 text-sm text-slate-600">
          Every option below shows the exact price and billing schedule.
        </p>
        <div className="mt-4 space-y-3">
          {cards.map((card) => (
            <article
              key={card.id}
              className={cn(
                "rounded-2xl border p-3",
                audience === "individual"
                  ? "border-[#f3dfd1] bg-white/80"
                  : "border-[#dbe9f7] bg-white/80"
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {card.context}
                  </p>
                  <h5 className="text-base font-semibold text-slate-900 sm:text-lg">
                    {card.title}
                  </h5>
                </div>
                <div className="flex flex-wrap gap-2">
                  {card.paymentBadges.map((badge) => (
                    <span
                      key={badge}
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                        audience === "individual"
                          ? "border-[#f3d4bf] bg-[#fff3e9] text-[#9a3412]"
                          : "border-[#cbe2f8] bg-[#ecf6ff] text-[#1e40af]"
                      )}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">What you get:</span>{" "}
                {card.included}
              </p>
            </article>
          ))}
        </div>
      </article>
    </div>
  );
}
