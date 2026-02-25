import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BrandedCardEntry from "@/components/dashboard/billing/BrandedCardEntry";
import BundlePaymentStatusPoller from "@/components/dashboard/billing/BundlePaymentStatusPoller";
import RemovePaymentMethodButton from "@/components/dashboard/billing/RemovePaymentMethodButton";
import SetDefaultPaymentMethodButton from "@/components/dashboard/billing/SetDefaultPaymentMethodButton";
import type { DashboardBillingData } from "@/lib/billing/dashboard";
import {
  formatMonthly,
  formatYearly,
  type PersonalProLoyaltyStatus,
  type PublicPricingSnapshot,
} from "@/lib/billing/pricing";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatIsoDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return DATE_FORMATTER.format(date);
}

function formatMinorAmount(value: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
    }).format(value / 100);
  } catch {
    return `${(value / 100).toFixed(2)} ${normalizedCurrency}`;
  }
}

function formatStatus(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function maskMiddle(value: string | null, prefix = 8, suffix = 6) {
  if (!value) return null;
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
}

function getBillingErrorMessage(errorCode: string) {
  switch (errorCode) {
    case "stripe_unavailable":
      return "Stripe is temporarily unavailable. Please try again shortly.";
    case "missing_price_configuration":
      return "Billing prices are not configured yet. Contact support to finish setup.";
    case "missing_bundle_price_configuration":
      return "Bundle checkout is not configured yet. Contact support to place your order.";
    case "missing_bundle_shipping_configuration":
      return "Bundle shipping rates are not configured yet. Contact support to finish checkout setup.";
    case "no_customer":
      return "We could not initialize your billing profile. Please retry or contact support.";
    case "checkout_unavailable":
      return "Checkout could not be started. Please retry in a moment.";
    case "portal_unavailable":
      return "Billing portal is temporarily unavailable. Please try again shortly.";
    case "no_active_subscription":
      return "No active subscription was found for this account.";
    default:
      return "Billing action could not be completed. Please retry.";
  }
}

type BillingContentProps = {
  pricing: PublicPricingSnapshot;
  personalProLoyalty: PersonalProLoyaltyStatus;
  billingData: DashboardBillingData | null;
  checkoutStatus?: "success" | "cancel" | "incomplete" | "processing" | null;
  checkoutPurchase?: "bundle" | null;
  checkoutSessionId?: string | null;
  billingErrorCode?: string | null;
  billingIntent?: "bundle" | "pro_monthly" | "pro_yearly" | null;
  billingResume?: "subscribe" | "bundle_checkout" | "portal" | "portal_plan" | null;
  subscriptionNotice?: "cancel_scheduled" | null;
};

export default function BillingContent({
  pricing,
  personalProLoyalty,
  billingData,
  checkoutStatus,
  checkoutPurchase,
  checkoutSessionId,
  billingErrorCode,
  billingIntent,
  billingResume,
  subscriptionNotice,
}: BillingContentProps) {
  const loyaltyEligibleOnLabel = formatIsoDate(personalProLoyalty.eligibleOn);
  const initialRateLabel = `${formatMonthly(personalProLoyalty.initialRate.monthly)} or ${formatYearly(personalProLoyalty.initialRate.yearly)}`;
  const loyaltyRateLabel = `${formatMonthly(personalProLoyalty.loyaltyRate.monthly)} or ${formatYearly(personalProLoyalty.loyaltyRate.yearly)}`;
  const discountDays =
    pricing.individual.paidWebOnlyPro.loyalty.requiredPaidDays;

  const summary = billingData?.summary ?? null;
  const complimentaryWindow = billingData?.complimentaryWindow ?? null;
  const paymentMethods = billingData?.paymentMethods ?? [];
  const invoices = billingData?.invoices ?? [];
  const bundlePurchases = billingData?.bundlePurchases ?? [];
  const periods = billingData?.periods ?? [];
  const stripeErrors = billingData?.stripe.errors ?? [];
  const billingWarnings = billingData?.warnings ?? [];
  const stripeEnabled = Boolean(billingData?.stripe.enabled);
  const hasManageableSubscription = Boolean(
    billingData?.subscription?.id || summary?.activeSubscriptionId
  );
  const subscribeMonthlyHref = "/api/billing/subscribe?interval=month";
  const subscribeYearlyHref = "/api/billing/subscribe?interval=year";
  const bundleCheckoutHref = "/api/billing/bundle-checkout";
  const cancelSubscriptionActionHref = "/api/billing/subscription/cancel";
  const planActionHref = hasManageableSubscription
    ? "/api/billing/portal?flow=plan"
    : subscribeMonthlyHref;
  const canManageBilling = stripeEnabled;
  const normalizedBillingErrorCode = billingErrorCode?.trim() || null;
  const billingErrorMessage = normalizedBillingErrorCode
    ? getBillingErrorMessage(normalizedBillingErrorCode)
    : null;
  const normalizedCheckoutSessionId = checkoutSessionId?.trim() || null;
  const checkoutSessionBundlePurchase = normalizedCheckoutSessionId
    ? bundlePurchases.find(
        (purchase) => purchase.checkoutSessionId === normalizedCheckoutSessionId
      ) ?? null
    : null;
  const bundleCheckoutLifecycleStatus =
    checkoutPurchase === "bundle" &&
    (checkoutStatus === "success" || checkoutStatus === "processing")
      ? checkoutSessionBundlePurchase
        ? checkoutSessionBundlePurchase.orderStatus === "paid" ||
          checkoutSessionBundlePurchase.purchaseStatus === "paid"
          ? "success"
          : checkoutSessionBundlePurchase.orderStatus === "refunded" ||
              checkoutSessionBundlePurchase.purchaseStatus === "refunded" ||
              checkoutSessionBundlePurchase.orderStatus === "canceled" ||
              checkoutSessionBundlePurchase.purchaseStatus === "canceled"
            ? "failed"
            : "processing"
        : checkoutStatus === "processing"
          ? "processing"
          : "success"
      : null;
  const shouldPollBundleSession =
    checkoutPurchase === "bundle" &&
    Boolean(normalizedCheckoutSessionId) &&
    bundleCheckoutLifecycleStatus === "processing";
  const activeBillingWarning = billingWarnings[0] ?? null;
  const fallbackSubscriptionRiskWarning =
    !activeBillingWarning &&
    (billingData?.subscription?.status === "past_due" ||
    billingData?.subscription?.status === "unpaid" ||
    billingData?.subscription?.status === "incomplete" ||
    billingData?.subscription?.status === "incomplete_expired")
      ? "A recent renewal attempt needs attention. Update your payment method to avoid interruption."
      : null;
  const loyaltyProgressPercent = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (personalProLoyalty.totalPaidDays /
          Math.max(1, personalProLoyalty.requiredPaidDays)) *
          100
      )
    )
  );

  return (
    <div className="space-y-6">
      {checkoutStatus === "success" ? (
        <p className="rounded-2xl border border-emerald-300 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
          {checkoutPurchase === "bundle" &&
          bundleCheckoutLifecycleStatus === "processing"
            ? "Bundle payment is processing. We will confirm it here as soon as Stripe finalizes the charge."
            : checkoutPurchase === "bundle" &&
                bundleCheckoutLifecycleStatus === "failed"
              ? "Bundle payment did not complete. No successful charge was recorded. You can restart checkout anytime."
            : checkoutPurchase === "bundle"
              ? "Bundle checkout completed successfully. Your receipt should be available shortly."
              : "Checkout completed successfully. Billing details may take up to a minute to refresh."}
        </p>
      ) : null}
      {checkoutPurchase === "bundle" &&
      bundleCheckoutLifecycleStatus === "processing" &&
      checkoutStatus !== "success" ? (
        <p className="rounded-2xl border border-blue-300 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          Bundle payment is processing. We will confirm it here as soon as Stripe finalizes the charge.
        </p>
      ) : null}
      {checkoutStatus !== "success" &&
      checkoutPurchase === "bundle" &&
      bundleCheckoutLifecycleStatus === "failed" ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          Bundle payment did not complete. No successful charge was recorded. You can restart checkout anytime.
        </p>
      ) : null}
      {checkoutStatus === "cancel" || checkoutStatus === "incomplete" ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          {checkoutPurchase === "bundle"
            ? "Bundle checkout was not completed. No charge was made. You can restart the purchase anytime."
            : "Checkout was canceled. You can restart anytime."}
        </p>
      ) : null}
      {checkoutStatus === "processing" && checkoutPurchase !== "bundle" ? (
        <p className="rounded-2xl border border-blue-300 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          Checkout is processing. Your billing details will update automatically once payment settles.
        </p>
      ) : null}
      {billingErrorMessage ? (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {billingErrorMessage}
        </p>
      ) : null}
      {activeBillingWarning || fallbackSubscriptionRiskWarning ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Billing attention needed</p>
          <p className="mt-1">
            {activeBillingWarning?.message ?? fallbackSubscriptionRiskWarning}
          </p>
          {canManageBilling && hasManageableSubscription ? (
            <form action="/api/billing/portal?flow=plan" method="post" className="mt-2">
              <Button type="submit" size="sm" variant="outline" className="rounded-full">
                Update card
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
      {billingResume === "portal_plan" ? (
        <div className="rounded-2xl border border-blue-300 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          <p className="font-semibold">Continue your plan changes</p>
          <p className="mt-1">
            You were redirected to sign in. Continue to Stripe billing portal to adjust your plan.
          </p>
          <form action="/api/billing/portal?flow=plan" method="post" className="mt-2">
            <Button type="submit" size="sm" className="rounded-full">
              Continue plan adjustments
            </Button>
          </form>
        </div>
      ) : null}
      {normalizedCheckoutSessionId ? (
        <BundlePaymentStatusPoller
          sessionId={normalizedCheckoutSessionId}
          enabled={shouldPollBundleSession}
        />
      ) : null}
      {subscriptionNotice === "cancel_scheduled" ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
          Cancellation scheduled. Your subscription stays active until the end of
          the current billing period, and future renewals will not be charged.
        </p>
      ) : null}
      {billingIntent ? (
        <div className="rounded-2xl border border-blue-300 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          <p className="font-semibold">
            {billingIntent === "bundle"
              ? "You selected the Web + Linket Bundle."
              : billingIntent === "pro_yearly"
                ? "You selected Paid Web-Only (Pro) yearly."
                : "You selected Paid Web-Only (Pro) monthly."}
          </p>
          <p className="mt-1 text-blue-900/90">
            {billingIntent === "bundle"
              ? "Complete checkout below. Bundle Pro starts when a Linket is claimed, and the claiming account receives the complimentary period (giftable flow)."
              : "Complete checkout below to activate this Pro billing interval."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {billingIntent === "bundle" ? (
              <form action={bundleCheckoutHref} method="post">
                <Button type="submit" size="sm" className="rounded-full">
                  Continue bundle checkout
                </Button>
              </form>
            ) : billingIntent === "pro_yearly" ? (
              <>
                <form action={subscribeYearlyHref} method="post">
                  <Button type="submit" size="sm" className="rounded-full">
                    Continue yearly checkout
                  </Button>
                </form>
                <form action={subscribeMonthlyHref} method="post">
                  <Button type="submit" size="sm" variant="outline" className="rounded-full">
                    Switch to monthly
                  </Button>
                </form>
              </>
            ) : (
              <>
                <form action={subscribeMonthlyHref} method="post">
                  <Button type="submit" size="sm" className="rounded-full">
                    Continue monthly checkout
                  </Button>
                </form>
                <form action={subscribeYearlyHref} method="post">
                  <Button type="submit" size="sm" variant="outline" className="rounded-full">
                    Switch to yearly
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">
                Plan overview
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                See your current plan, renewal timing, and support references.
              </p>
            </div>
            {canManageBilling ? (
              <form action={planActionHref} method="post">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                >
                  Adjust plan
                </Button>
              </form>
            ) : (
              <Button variant="outline" size="sm" className="rounded-full" disabled>
                Billing portal unavailable
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {complimentaryWindow?.active ? (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
                Complimentary Pro is active through{" "}
                {formatIsoDate(complimentaryWindow.endsAt) ?? "--"}.
                {typeof complimentaryWindow.daysRemaining === "number"
                  ? ` ${complimentaryWindow.daysRemaining} day${complimentaryWindow.daysRemaining === 1 ? "" : "s"} remaining before billing can start.`
                  : ""}
                {" "}You can still add a payment method now.
              </div>
            ) : null}
            {summary ? (
              <div className="space-y-4 rounded-2xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">
                      {summary.planName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Current billing status
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {formatStatus(summary.status)}
                  </Badge>
                </div>
                <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border bg-card/35 p-3">
                    <dt className="font-semibold text-foreground">
                      Current period
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatIsoDate(summary.currentPeriodStart) ?? "--"} to{" "}
                      {formatIsoDate(summary.currentPeriodEnd) ?? "--"}
                    </dd>
                  </div>
                  <div className="rounded-xl border bg-card/35 p-3">
                    <dt className="font-semibold text-foreground">Renews on</dt>
                    <dd className="mt-1 text-sm">
                      {formatIsoDate(summary.renewsOn) ?? "--"}
                    </dd>
                  </div>
                  <div className="rounded-xl border bg-card/35 p-3">
                    <dt className="font-semibold text-foreground">Auto renew</dt>
                    <dd className="mt-1 text-sm">
                      {summary.autoRenews === null
                        ? "Unknown"
                        : summary.autoRenews
                          ? "On"
                          : "Off"}
                    </dd>
                  </div>
                  <div className="rounded-xl border bg-card/35 p-3">
                    <dt className="font-semibold text-foreground">
                      Billing provider
                    </dt>
                    <dd className="mt-1 text-sm">
                      {stripeEnabled ? "Stripe connected" : "Stripe unavailable"}
                    </dd>
                  </div>
                </dl>

                <div className="rounded-xl border bg-card/30 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Support references
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Share these only with Linket support when troubleshooting
                    billing.
                  </p>
                  <dl className="mt-2 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="rounded-lg border bg-card/45 p-2.5">
                      <dt className="font-semibold text-foreground">
                        Subscription reference
                      </dt>
                      <dd>
                        <span
                          className="block break-all font-mono text-foreground"
                          title={summary.activeSubscriptionId ?? undefined}
                        >
                          {summary.activeSubscriptionId ?? "Not available yet"}
                        </span>
                        <span className="mt-1 block text-[11px] leading-relaxed">
                          Stripe subscription ID used only for billing support.
                        </span>
                      </dd>
                    </div>
                    <div className="rounded-lg border bg-card/45 p-2.5">
                      <dt className="font-semibold text-foreground">
                        Billing profile reference
                      </dt>
                      <dd>
                        <span
                          className="block break-all font-mono text-foreground"
                          title={summary.customerId ?? undefined}
                        >
                          {summary.customerId ?? "Not available yet"}
                        </span>
                        <span className="mt-1 block text-[11px] leading-relaxed">
                          Stripe customer ID for your account&apos;s billing
                          profile.
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
                Billing data is not available yet for this account.
              </div>
            )}

            {canManageBilling && !hasManageableSubscription ? (
              <div className="rounded-2xl border border-dashed px-3 py-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">
                  Ready to start paid billing?
                </p>
                <p className="mt-1">
                  Choose monthly or yearly to activate your paid Pro plan.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={subscribeMonthlyHref} method="post">
                    <Button type="submit" size="sm" variant="outline" className="rounded-full">
                      Monthly
                    </Button>
                  </form>
                  <form action={subscribeYearlyHref} method="post">
                    <Button type="submit" size="sm" variant="outline" className="rounded-full">
                      Yearly
                    </Button>
                  </form>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <div>
              <CardTitle className="text-lg font-semibold">
                Payment methods
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Add, replace, or remove cards directly on this page.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stripeEnabled ? <BrandedCardEntry /> : null}
            {!stripeEnabled ? (
              <p className="rounded-2xl border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-900">
                Stripe billing is currently unavailable for this account.
              </p>
            ) : null}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Saved payment methods
              </p>
              {paymentMethods.length === 0 ? (
                <p className="rounded-2xl border p-3 text-sm text-muted-foreground">
                  No card details available for this account yet.
                </p>
              ) : (
                paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/60 p-3 text-sm shadow-sm"
                  >
                    <div>
                      <div className="font-semibold text-foreground">
                        {(method.brand ?? "Card").toUpperCase()} ending in{" "}
                        {method.last4 ?? "----"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expires{" "}
                        {method.expMonth && method.expYear
                          ? `${String(method.expMonth).padStart(2, "0")}/${method.expYear}`
                          : "--/--"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Reference:{" "}
                        <span className="font-mono">
                          {maskMiddle(method.id) ?? "--"}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.isDefault ? (
                        <Badge variant="outline" className="rounded-full">
                          Default
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="secondary" className="rounded-full">
                            Backup
                          </Badge>
                          <SetDefaultPaymentMethodButton paymentMethodId={method.id} />
                        </>
                      )}
                      <RemovePaymentMethodButton
                        paymentMethodId={method.id}
                        isDefault={method.isDefault}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Billing health
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Quick totals from Stripe billing periods.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <UsageStat
                label="Paid periods"
                value={summary?.paidPeriods ?? 0}
                helper="Successful paid billing windows"
              />
              <UsageStat
                label="Refunded periods"
                value={summary?.refundedPeriods ?? 0}
                helper="Windows marked refunded"
              />
              <UsageStat
                label="Voided periods"
                value={summary?.voidedPeriods ?? 0}
                helper="Windows marked voided"
              />
            </div>

            {stripeErrors.length > 0 ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/50 px-3 py-2 text-xs text-amber-900">
                <p className="font-semibold">Stripe sync warnings</p>
                <ul className="mt-1 space-y-1">
                  {stripeErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-2xl border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
                No Stripe sync warnings right now.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold">
                Personal Pro loyalty discount
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Your renewal rate drops after enough paid time.
              </p>
            </div>
            <Badge
              variant={personalProLoyalty.eligible ? "secondary" : "outline"}
              className="rounded-full"
            >
              {personalProLoyalty.eligible ? "Active" : "Pending"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card/60 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em]">
                  Initial renewal rate
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {initialRateLabel}
                </p>
              </div>
              <div className="rounded-2xl border bg-card/60 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em]">
                  Loyalty renewal rate
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {loyaltyRateLabel}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">
                  Progress
                </p>
                <p>
                  {personalProLoyalty.totalPaidDays}/
                  {personalProLoyalty.requiredPaidDays} paid days (
                  {loyaltyProgressPercent}%)
                </p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${loyaltyProgressPercent}%` }}
                />
              </div>
            </div>

            {personalProLoyalty.eligible ? (
              <p className="rounded-2xl border border-emerald-300 bg-emerald-50/60 px-3 py-2 text-emerald-900">
                Loyalty discount is active for your personal Pro renewal rate.
              </p>
            ) : loyaltyEligibleOnLabel ? (
              <p className="rounded-2xl border bg-card/50 px-3 py-2">
                Eligible on {loyaltyEligibleOnLabel}
                {typeof personalProLoyalty.daysUntilEligible === "number"
                  ? ` (${personalProLoyalty.daysUntilEligible} day${personalProLoyalty.daysUntilEligible === 1 ? "" : "s"} remaining).`
                  : "."}
              </p>
            ) : (
              <p className="rounded-2xl border bg-card/50 px-3 py-2">
                Paid time is cumulative, so canceled and restarted paid periods
                still count toward loyalty.
              </p>
            )}

            <p>
              After {discountDays} total paid days (continuous or
              discontinuous), renewals move from {initialRateLabel} to{" "}
              {loyaltyRateLabel}.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Bundle orders
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Track physical-order payment state, shipping details, and receipts. Purchaser and claimant can be different accounts.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {bundlePurchases.length === 0 ? (
              <p className="rounded-2xl border p-3 text-sm text-muted-foreground">
                No bundle orders recorded yet.
              </p>
            ) : (
              bundlePurchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2"
                >
                  <div>
                    <div className="font-semibold text-foreground">
                      {formatMinorAmount(purchase.totalMinor, purchase.currency)} - Qty{" "}
                      {purchase.quantity}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ordered {formatIsoDate(purchase.purchasedAt) ?? "--"}
                      {purchase.shippingName ? ` - Ship to ${purchase.shippingName}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Session:{" "}
                      <span
                        className="font-mono text-foreground"
                        title={purchase.checkoutSessionId}
                      >
                        {maskMiddle(purchase.checkoutSessionId) ?? "--"}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">
                      Purchase {formatStatus(purchase.purchaseStatus)}
                    </Badge>
                    <Badge variant="outline" className="rounded-full">
                      Order {formatStatus(purchase.orderStatus)}
                    </Badge>
                    {purchase.receiptUrl ? (
                      <Button variant="ghost" size="sm" asChild className="rounded-full">
                        <a href={purchase.receiptUrl} target="_blank" rel="noreferrer">
                          Receipt
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Receipt pending</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Invoices</CardTitle>
            <p className="text-sm text-muted-foreground">
              Receipts and charge status from Stripe.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invoices.length === 0 ? (
              <p className="rounded-2xl border p-3 text-sm text-muted-foreground">
                No invoices available yet.
              </p>
            ) : (
              invoices.map((invoice) => {
                const invoiceLink =
                  invoice.hostedInvoiceUrl ?? invoice.invoicePdfUrl;
                const periodLabel =
                  formatIsoDate(invoice.periodStart) && formatIsoDate(invoice.periodEnd)
                    ? `${formatIsoDate(invoice.periodStart)} - ${formatIsoDate(invoice.periodEnd)}`
                    : formatIsoDate(invoice.createdAt) ?? "Unknown period";

                return (
                  <div
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2"
                  >
                    <div>
                      <div className="font-semibold text-foreground">
                        {invoice.number ?? invoice.id}
                      </div>
                      <p className="text-xs text-muted-foreground">{periodLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">
                        {formatMinorAmount(invoice.amountPaidMinor, invoice.currency)}
                      </span>
                      <Badge variant="secondary" className="rounded-full">
                        {formatStatus(invoice.status)}
                      </Badge>
                      {invoiceLink ? (
                        <Button variant="ghost" size="sm" asChild className="rounded-full">
                          <a href={invoiceLink} target="_blank" rel="noreferrer">
                            Receipt
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No receipt</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Billing period history
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Stripe periods recorded by webhook events.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {periods.length === 0 ? (
              <p className="rounded-2xl border p-3 text-sm text-muted-foreground">
                No Stripe billing periods recorded yet.
              </p>
            ) : (
              periods.map((period) => (
                <div
                  key={period.id}
                  className="rounded-2xl border p-3 text-sm text-muted-foreground"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {formatIsoDate(period.periodStart) ?? "--"} to{" "}
                      {formatIsoDate(period.periodEnd) ?? "--"}
                    </span>
                    <Badge variant="outline" className="rounded-full">
                      {formatStatus(period.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs">
                    Subscription reference:{" "}
                    <span
                      className="font-mono text-foreground"
                      title={period.subscriptionId}
                    >
                      {maskMiddle(period.subscriptionId) ?? "--"}
                    </span>
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {canManageBilling && hasManageableSubscription ? (
        <section className="space-y-3">
          {summary?.autoRenews !== false ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/70 px-3 py-3 text-xs text-amber-900">
              <p className="font-semibold">Need to stop future payments?</p>
              <p className="mt-1">
                You can cancel renewal anytime. Access remains active until the
                current period ends.
              </p>
              <form
                action={cancelSubscriptionActionHref}
                method="post"
                className="mt-2"
              >
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center rounded-full border border-[#b91c1c] bg-[#dc2626] px-3 text-sm font-medium text-white transition-colors hover:bg-[#b91c1c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-50"
                >
                  Cancel future renewals
                </button>
              </form>
            </div>
          ) : (
            <p className="rounded-2xl border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
              Cancellation is already scheduled for your current subscription.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}

function UsageStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
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

