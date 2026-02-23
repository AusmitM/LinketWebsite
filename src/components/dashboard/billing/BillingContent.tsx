"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/system/toaster";
import { BILLING_PLANS, getPlanDisplay, isCheckoutPlanKey } from "@/lib/billing/plans";
import type { BillingSummary, CheckoutPlanKey } from "@/types/billing";

type BillingSummaryResponse = BillingSummary | { error: string };

const CHECKOUT_PLAN_ORDER: CheckoutPlanKey[] = [
  "pro_monthly",
  "pro_yearly",
  "bundle_59",
];

function formatEndDate(value: string | null) {
  if (!value) return "No renewal date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No renewal date";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState<CheckoutPlanKey | null>(
    null
  );
  const [portalPending, setPortalPending] = useState(false);
  const [autoCheckoutHandled, setAutoCheckoutHandled] = useState(false);
  const [handledCheckoutStatus, setHandledCheckoutStatus] = useState<
    string | null
  >(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setSummaryError(null);
    try {
      const response = await fetch("/api/billing/summary", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as BillingSummaryResponse | null;
      if (!response.ok) {
        const message =
          payload && "error" in payload
            ? payload.error
            : "Unable to load billing summary.";
        throw new Error(message);
      }
      setSummary(payload as BillingSummary);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load billing summary.";
      setSummaryError(message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const startCheckout = useCallback(
    async (planKey: CheckoutPlanKey, source: "landing" | "dashboard" = "dashboard") => {
      setCheckoutPending(planKey);
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planKey, source }),
        });

        if (response.status === 401) {
          const next = `/dashboard/billing?checkout=${encodeURIComponent(planKey)}&source=${source}`;
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
      } finally {
        setCheckoutPending(null);
      }
    },
    [router]
  );

  const openBillingPortal = useCallback(async () => {
    setPortalPending(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Unable to open billing portal.");
      }
      window.location.assign(payload.url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to open billing portal.";
      toast({
        title: "Portal unavailable",
        description: message,
        variant: "destructive",
      });
    } finally {
      setPortalPending(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    const sourceParam = searchParams.get("source");
    const checkoutSource = sourceParam === "landing" ? "landing" : "dashboard";
    if (!checkoutStatus) return;

    if (checkoutStatus === "success" && handledCheckoutStatus !== "success") {
      setHandledCheckoutStatus("success");
      toast({
        title: "Checkout complete",
        description: "Your billing details are updating now.",
        variant: "success",
      });
      void loadSummary();
      return;
    }
    if (
      checkoutStatus === "cancelled" &&
      handledCheckoutStatus !== "cancelled"
    ) {
      setHandledCheckoutStatus("cancelled");
      toast({
        title: "Checkout cancelled",
        description: "No changes were made to your plan.",
      });
      return;
    }

    if (autoCheckoutHandled) return;
    if (isCheckoutPlanKey(checkoutStatus)) {
      setAutoCheckoutHandled(true);
      void startCheckout(checkoutStatus, checkoutSource);
    }
  }, [
    autoCheckoutHandled,
    searchParams,
    handledCheckoutStatus,
    loadSummary,
    startCheckout,
  ]);

  const planCards = useMemo(() => {
    const proDiscountEligible = summary?.proDiscountEligibility.eligible ?? false;
    return CHECKOUT_PLAN_ORDER.map((planKey) => {
      const definition = BILLING_PLANS[planKey];
      const display = getPlanDisplay(planKey, proDiscountEligible);
      const isCurrent = summary?.activePlanKey === planKey;
      const isPending = checkoutPending === planKey;
      return {
        key: planKey,
        name: definition.name,
        price: display.displayPrice,
        billingLabel: display.billingLabel,
        isCurrent,
        isPending,
      };
    });
  }, [
    checkoutPending,
    summary?.activePlanKey,
    summary?.proDiscountEligibility.eligible,
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Current plan</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage subscriptions, bundle purchases, and renewals.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => void openBillingPortal()}
              disabled={portalPending}
            >
              {portalPending ? "Opening..." : "Manage subscription"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
              </div>
            ) : summaryError ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {summaryError}
              </div>
            ) : summary ? (
              <>
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border p-4">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {summary.activePlanName}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Active plan key: {summary.activePlanKey}
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    Renews {formatEndDate(summary.subscription?.currentPeriodEnd ?? summary.entitlement?.endsAt ?? null)}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <UsageStat
                    label="Paid access"
                    value={summary.hasPaidAccess ? "Yes" : "No"}
                    helper="Free users can upgrade anytime."
                  />
                  <UsageStat
                    label="Subscription status"
                    value={summary.subscription?.status ?? "none"}
                    helper="Managed by Stripe webhooks."
                  />
                  <UsageStat
                    label="Entitlement source"
                    value={summary.entitlement?.sourceType ?? "none"}
                    helper="subscription, bundle, or linket offer"
                  />
                </div>
                {summary.renewalPrompt.shouldShow ? (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    <p className="font-semibold">Bundle renewal reminder</p>
                    <p className="mt-1">
                      Your included Pro access ends in{" "}
                      {summary.renewalPrompt.daysUntilExpiry ?? 0} day(s). Pick a renewal
                      plan below to avoid interruption.
                    </p>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {summary.proDiscountEligibility.eligible ? (
                    <span>
                      Loyalty discount unlocked: Pro renewals now use discounted pricing.
                    </span>
                  ) : (
                    <span>
                      Loyalty discount unlock progress:{" "}
                      {summary.proDiscountEligibility.accumulatedPaidDays}/
                      {summary.proDiscountEligibility.requiredPaidDays} paid days
                      completed.{" "}
                      {summary.proDiscountEligibility.remainingPaidDays} paid day(s)
                      remaining.
                    </span>
                  )}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Business plans</CardTitle>
            <p className="text-sm text-muted-foreground">
              Business pricing is sales-led in phase 1.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl border p-3">
              <p className="font-semibold text-foreground">Business Generic</p>
              <p className="text-xs text-muted-foreground">
                One-time hardware purchase + $6/user/month (contact sales).
              </p>
            </div>
            <div className="rounded-2xl border p-3">
              <p className="font-semibold text-foreground">Custom Design Add-On</p>
              <p className="text-xs text-muted-foreground">
                $499 setup + $6/user/month, handled via consult flow.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link href="/#customization">Contact sales</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {planCards.map((plan) => (
          <Card key={plan.key} className="rounded-3xl border bg-card/80 shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-semibold">{plan.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{plan.billingLabel}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-semibold text-foreground">{plan.price}</p>
              {plan.isCurrent ? (
                <Badge variant="secondary" className="rounded-full">
                  Current plan
                </Badge>
              ) : (
                <Button
                  className="w-full rounded-full"
                  onClick={() => void startCheckout(plan.key)}
                  disabled={plan.isPending}
                >
                  {plan.isPending ? "Redirecting..." : "Choose this option"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function UsageStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border bg-card/60 p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <p className="text-[10px] text-muted-foreground">{helper}</p>
    </div>
  );
}
