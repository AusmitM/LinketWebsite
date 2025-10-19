import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Plan = {
  title: string;
  description: string;
  price: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: string;
};

const PLANS: Plan[] = [
  {
    title: "Individual",
    description: "One Linket, unlimited updates, analytics included. Perfect for students and creators.",
    price: "$19",
    features: ["Live preview in 60 seconds", "Tap analytics + export", "Includes engraving credit"],
    cta: { label: "Customize yours", href: "/customize?preset=student" },
  },
  {
    title: "Business packs",
    description: "Teams from 5-250 with admin dashboard, bulk editing, and concierge rollout.",
    price: "From $15/user",
    highlight: "Best value",
    features: ["Bulk dashboard + permissions", "CRM + Slack integrations", "Concierge onboarding"],
    cta: { label: "Plan my rollout", href: "/contact?topic=team" },
  },
  {
    title: "Events",
    description: "Personalized badges and keepsakes for conferences, workshops, and VIP suites.",
    price: "Custom quote",
    features: ["Badge + lanyard kits", "Schedule & sponsor modules", "Onsite concierge support"],
    cta: { label: "Start event kit", href: "/customize?preset=event" },
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <header className="mb-8 space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-[#0f172a]">Pricing</h1>
        <p className="text-sm text-muted-foreground">No subscriptions unless you want extras. Free US shipping over $75 and concierge support on every plan.</p>
        <div className="mx-auto w-full max-w-xl rounded-full border border-dashed bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          Free shipping at $75 · 10% off 10+ units · Ask us about EDU and non-profit pricing
        </div>
      </header>
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const analyticsId = `pricing_${plan.title.toLowerCase().replace(/\s+/g, "_")}`;
          return (
            <Card key={plan.title} className="flex flex-col rounded-3xl border bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg font-semibold text-[#0f172a]">
                  {plan.title}
                  {plan.highlight && (
                    <span className="rounded-full bg-[var(--accent)]/70 px-2 py-1 text-xs uppercase tracking-wide text-[color:var(--foreground)]">{plan.highlight}</span>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="text-2xl font-semibold text-foreground">{plan.price}</div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-[var(--primary)]" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-auto rounded-full" data-analytics-id={analyticsId}>
                  <Link href={plan.cta.href}>{plan.cta.label}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <section className="mt-10 grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
        <div className="rounded-3xl border bg-muted/40 p-4">
          <p className="text-sm font-medium text-foreground">Need financing?</p>
          <p className="mt-1">Split payments over 3 months for orders $250+ — talk to concierge at checkout.</p>
        </div>
        <div className="rounded-3xl border bg-muted/40 p-4">
          <p className="text-sm font-medium text-foreground">Global shipping</p>
          <p className="mt-1">We ship worldwide. Duties pre-paid for US, CA, EU, and AUS deliveries.</p>
        </div>
        <div className="rounded-3xl border bg-muted/40 p-4">
          <p className="text-sm font-medium text-foreground">Want a sample?</p>
          <p className="mt-1">
            Order a sample pack <Link href="/customize?preset=creator" className="underline">here</Link> and we’ll credit it toward your full rollout.
          </p>
        </div>
      </section>
    </main>
  );
}
