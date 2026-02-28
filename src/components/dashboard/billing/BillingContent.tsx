import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BrandedCardEntry from "@/components/dashboard/billing/BrandedCardEntry";
import BillingStripeActionButton from "@/components/dashboard/billing/BillingStripeActionButton";
import BillingTransientStateCleaner from "@/components/dashboard/billing/BillingTransientStateCleaner";
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

const BILLING_PRIMARY_BUTTON_CLASS =
  "!rounded-full !border !border-slate-900 !bg-none !bg-slate-900 !text-white hover:!bg-slate-800 hover:!text-white focus-visible:!ring-slate-500";
const BILLING_SECONDARY_BUTTON_CLASS =
  "!rounded-full !border !border-slate-300 !bg-none !bg-white !text-slate-900 hover:!bg-slate-100 hover:!text-slate-900 focus-visible:!ring-slate-400";

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

function readText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readRecordText(
  record: Record<string, unknown> | null,
  keys: string[]
) {
  if (!record) return null;
  for (const key of keys) {
    const value = readText(record[key]);
    if (value) return value;
  }
  return null;
}

type ShippingAddressParts = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

function readShippingAddressParts(
  address: Record<string, unknown> | null
): ShippingAddressParts {
  return {
    line1: readRecordText(address, ["line1", "line_1", "address_line1"]),
    line2: readRecordText(address, ["line2", "line_2", "address_line2"]),
    city: readRecordText(address, ["city", "locality"]),
    state: readRecordText(address, ["state", "province", "region"]),
    postalCode: readRecordText(address, ["postal_code", "postalCode", "zip"]),
    country: readRecordText(address, ["country", "country_code", "countryCode"]),
  };
}

function formatCityStatePostal(parts: ShippingAddressParts) {
  const city = parts.city ?? "";
  const state = parts.state ?? "";
  const postalCode = parts.postalCode ?? "";
  const cityState = [city, state].filter(Boolean).join(", ");
  if (!cityState && !postalCode) return null;
  if (!cityState) return postalCode;
  if (!postalCode) return cityState;
  return `${cityState} ${postalCode}`;
}

function formatShippingAddressLines(address: Record<string, unknown> | null) {
  if (!address) return null;
  const parts = readShippingAddressParts(address);
  const cityStatePostal = formatCityStatePostal(parts);
  const lines = [parts.line1, parts.line2, cityStatePostal, parts.country].filter(
    (value): value is string => Boolean(value)
  );
  return lines.length > 0 ? lines : null;
}

function hasStreetAddress(address: Record<string, unknown> | null) {
  return Boolean(readShippingAddressParts(address).line1);
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
    case "bundle_tax_configuration_required":
      return "Stripe Tax setup is incomplete. Add your business head-office address in Stripe Tax settings, then retry checkout.";
    case "no_customer":
      return "We could not initialize your billing profile. Please retry or contact support.";
    case "checkout_unavailable":
      return "Checkout could not be started. Please retry in a moment.";
    case "portal_unavailable":
      return "Billing portal is temporarily unavailable. Please try again shortly.";
    case "invalid_request_origin":
      return "Request validation failed. Refresh the page and try again.";
    case "no_active_subscription":
      return "No active subscription was found for this account.";
    default:
      return "Billing action could not be completed. Please retry.";
  }
}

type BillingContentProps = {
  pricing: PublicPricingSnapshot;
  personalProLoyalty: PersonalProLoyaltyStatus | null;
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
  const loyaltyDefault = pricing.individual.paidWebOnlyPro;
  const loyaltySnapshot = personalProLoyalty;
  const hasLoyaltyStatus = loyaltySnapshot !== null;
  const initialRate = loyaltySnapshot?.initialRate ?? loyaltyDefault.initial;
  const loyaltyRate = loyaltySnapshot?.loyaltyRate ?? loyaltyDefault.loyalty.rate;
  const requiredPaidDays =
    loyaltySnapshot?.requiredPaidDays ?? loyaltyDefault.loyalty.requiredPaidDays;
  const totalPaidDays = loyaltySnapshot?.totalPaidDays ?? 0;
  const loyaltyEligible = loyaltySnapshot?.eligible ?? false;
  const loyaltyDaysUntilEligible = loyaltySnapshot?.daysUntilEligible ?? null;
  const loyaltyEligibleOnLabel = formatIsoDate(loyaltySnapshot?.eligibleOn ?? null);
  const initialRateLabel = `${formatMonthly(initialRate.monthly)} or ${formatYearly(initialRate.yearly)}`;
  const loyaltyRateLabel = `${formatMonthly(loyaltyRate.monthly)} or ${formatYearly(loyaltyRate.yearly)}`;
  const discountDays = loyaltyDefault.loyalty.requiredPaidDays;

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
  const portalPlanHref = "/api/billing/portal?flow=plan";
  const cancelSubscriptionActionHref = "/api/billing/subscription/cancel";
  const planActionHref = hasManageableSubscription
    ? portalPlanHref
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
  const hasBundleProcessingWithoutSessionId =
    checkoutPurchase === "bundle" &&
    checkoutStatus === "processing" &&
    !normalizedCheckoutSessionId;
  const activeBillingWarning = billingWarnings[0] ?? null;
  const fallbackSubscriptionRiskWarning =
    !activeBillingWarning &&
    (billingData?.subscription?.status === "past_due" ||
    billingData?.subscription?.status === "unpaid" ||
    billingData?.subscription?.status === "incomplete" ||
    billingData?.subscription?.status === "incomplete_expired")
      ? "A recent renewal attempt needs attention. Update your payment method to avoid interruption."
      : null;
  const loyaltyProgressPercent = hasLoyaltyStatus
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round((totalPaidDays / Math.max(1, requiredPaidDays)) * 100)
        )
      )
    : 0;
  const complimentaryEndsLabel = formatIsoDate(complimentaryWindow?.endsAt ?? null);
  const complimentaryStartsLabel = formatIsoDate(complimentaryWindow?.startsAt ?? null);
  const hasUpcomingComplimentaryWindow =
    Boolean(complimentaryWindow?.eligible) &&
    !complimentaryWindow?.active &&
    typeof complimentaryWindow?.startsInDays === "number" &&
    complimentaryWindow.startsInDays > 0;

  return (
    <div className="space-y-6">
      <BillingTransientStateCleaner
        checkoutStatus={checkoutStatus ?? null}
        checkoutPurchase={checkoutPurchase ?? null}
        checkoutSessionId={normalizedCheckoutSessionId}
        billingErrorCode={normalizedBillingErrorCode}
      />
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
      checkoutStatus !== "success" &&
      normalizedCheckoutSessionId ? (
        <p className="rounded-2xl border border-blue-300 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          Bundle payment is processing. We will confirm it here as soon as Stripe finalizes the charge.
        </p>
      ) : null}
      {hasBundleProcessingWithoutSessionId ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Bundle status check needs a refresh</p>
          <p className="mt-1">
            We could not verify this bundle payment automatically because the
            checkout session reference is missing. Refresh billing details or
            restart checkout.
          </p>
          <div className="mt-2">
            <BillingStripeActionButton
              size="sm"
              className={BILLING_PRIMARY_BUTTON_CLASS}
              href={bundleCheckoutHref}
              idleLabel="Restart bundle checkout"
            />
          </div>
        </div>
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
            <BillingStripeActionButton
              size="sm"
              variant="outline"
              className={`mt-2 ${BILLING_SECONDARY_BUTTON_CLASS}`}
              href={portalPlanHref}
              idleLabel="Update card"
            />
          ) : null}
        </div>
      ) : null}
      {billingResume === "portal_plan" ? (
        <div className="rounded-2xl border border-slate-300 bg-slate-100/90 px-4 py-3 text-sm text-slate-900">
          <p className="font-semibold">Continue your plan changes</p>
          <p className="mt-1 text-slate-700">
            You were redirected to sign in. Continue to Stripe billing portal to adjust your plan.
          </p>
          <BillingStripeActionButton
            size="sm"
            className={`mt-2 ${BILLING_PRIMARY_BUTTON_CLASS}`}
            href={portalPlanHref}
            idleLabel="Continue plan adjustments"
          />
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
        <div className="rounded-2xl border border-slate-300 bg-slate-100/90 px-4 py-3 text-sm text-slate-900">
          <p className="font-semibold">
            {billingIntent === "bundle"
              ? "You selected the Web + Linket Bundle."
              : billingIntent === "pro_yearly"
                ? "You selected Paid Web-Only (Pro) yearly."
                : "You selected Paid Web-Only (Pro) monthly."}
          </p>
          <p className="mt-1 text-slate-700">
            {billingIntent === "bundle"
              ? "Complete checkout below. Complimentary Pro begins when the Linket is claimed; if a paid cycle is already active, it begins at the next renewal boundary."
              : "Complete checkout below to activate this Pro billing interval."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {billingIntent === "bundle" ? (
              <BillingStripeActionButton
                size="sm"
                className={BILLING_PRIMARY_BUTTON_CLASS}
                href={bundleCheckoutHref}
                idleLabel="Continue bundle checkout"
              />
            ) : billingIntent === "pro_yearly" ? (
              <>
                <BillingStripeActionButton
                  size="sm"
                  className={BILLING_PRIMARY_BUTTON_CLASS}
                  href={subscribeYearlyHref}
                  idleLabel="Continue yearly checkout"
                />
                <BillingStripeActionButton
                  size="sm"
                  variant="outline"
                  className={BILLING_SECONDARY_BUTTON_CLASS}
                  href={subscribeMonthlyHref}
                  idleLabel="Switch to monthly"
                />
              </>
            ) : (
              <>
                <BillingStripeActionButton
                  size="sm"
                  className={BILLING_PRIMARY_BUTTON_CLASS}
                  href={subscribeMonthlyHref}
                  idleLabel="Continue monthly checkout"
                />
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
              <BillingStripeActionButton
                variant="outline"
                size="sm"
                className={BILLING_SECONDARY_BUTTON_CLASS}
                href={planActionHref}
                idleLabel="Adjust plan"
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className={BILLING_SECONDARY_BUTTON_CLASS}
                disabled
              >
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
            ) : hasUpcomingComplimentaryWindow ? (
              <div className="rounded-2xl border border-blue-300 bg-blue-50/60 px-3 py-2 text-sm text-blue-950">
                Complimentary Pro is scheduled to begin on{" "}
                {complimentaryStartsLabel ?? "--"} (next renewal boundary) and
                continue through {complimentaryEndsLabel ?? "--"}.
                {typeof complimentaryWindow?.startsInDays === "number"
                  ? ` Starts in ${complimentaryWindow.startsInDays} day${complimentaryWindow.startsInDays === 1 ? "" : "s"}.`
                  : ""}
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
                  <BillingStripeActionButton
                    size="sm"
                    variant="outline"
                    className={BILLING_SECONDARY_BUTTON_CLASS}
                    href={subscribeMonthlyHref}
                    idleLabel="Monthly"
                  />
                  <BillingStripeActionButton
                    size="sm"
                    variant="outline"
                    className={BILLING_SECONDARY_BUTTON_CLASS}
                    href={subscribeYearlyHref}
                    idleLabel="Yearly"
                  />
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
              variant={loyaltyEligible ? "secondary" : "outline"}
              className="rounded-full"
            >
              {hasLoyaltyStatus ? (loyaltyEligible ? "Active" : "Pending") : "Unavailable"}
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
                {hasLoyaltyStatus ? (
                  <p>
                    {totalPaidDays}/{requiredPaidDays} paid days (
                    {loyaltyProgressPercent}%)
                  </p>
                ) : (
                  <p>Loyalty data unavailable</p>
                )}
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${loyaltyProgressPercent}%` }}
                />
              </div>
              {complimentaryWindow?.active ? (
                <p className="mt-2 rounded-xl border border-slate-300 bg-slate-100/80 px-2 py-1 text-[11px] text-slate-800">
                  Loyalty is paused during complimentary Pro until{" "}
                  {complimentaryEndsLabel ?? "--"}. Paid-day progress resumes
                  after complimentary coverage ends.
                </p>
              ) : null}
            </div>

            {!hasLoyaltyStatus ? (
              <p className="rounded-2xl border border-amber-300 bg-amber-50/60 px-3 py-2 text-amber-900">
                Loyalty status is temporarily unavailable. Refresh billing
                details in a moment.
              </p>
            ) : loyaltyEligible ? (
              <p className="rounded-2xl border border-emerald-300 bg-emerald-50/60 px-3 py-2 text-emerald-900">
                Loyalty discount is active for your personal Pro renewal rate.
              </p>
            ) : loyaltyEligibleOnLabel ? (
              <p className="rounded-2xl border bg-card/50 px-3 py-2">
                Eligible on {loyaltyEligibleOnLabel}
                {typeof loyaltyDaysUntilEligible === "number"
                  ? ` (${loyaltyDaysUntilEligible} day${loyaltyDaysUntilEligible === 1 ? "" : "s"} remaining).`
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
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">
                Bundle orders
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Track physical-order payment state, shipping details, and receipts. Purchaser and claimant can be different accounts.
              </p>
            </div>
            {stripeEnabled ? (
              <BillingStripeActionButton
                size="sm"
                className={BILLING_PRIMARY_BUTTON_CLASS}
                href={bundleCheckoutHref}
                idleLabel="Get Linket Bundle"
              />
            ) : (
              <Button size="sm" className={BILLING_PRIMARY_BUTTON_CLASS} disabled>
                Bundle checkout unavailable
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {bundlePurchases.length === 0 ? (
              <p className="rounded-2xl border p-3 text-sm text-muted-foreground">
                No bundle orders recorded yet.
              </p>
            ) : (
              bundlePurchases.map((purchase) => {
                const etaLabel =
                  formatIsoDate(purchase.estimatedDeliveryDate) ??
                  purchase.estimatedDeliveryDate;
                const shippingAddressLines = formatShippingAddressLines(
                  purchase.shippingAddress
                );
                const shippingAddressLabel = shippingAddressLines
                  ? shippingAddressLines.join("\n")
                  : null;
                const fulfillmentLabel = purchase.fulfillmentStatus
                  ? formatStatus(purchase.fulfillmentStatus)
                  : "Pending";
                const recipientLabel = purchase.shippingName ?? "Not provided";
                const phoneLabel = purchase.shippingPhone ?? "Not provided";
                const partialAddress =
                  Boolean(shippingAddressLines) &&
                  !hasStreetAddress(purchase.shippingAddress);

                return (
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
                          className="block break-all font-mono text-foreground"
                          title={purchase.checkoutSessionId}
                        >
                          {purchase.checkoutSessionId || "--"}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Recipient: <span className="text-foreground">{recipientLabel}</span>
                        {" · "}
                        Phone: <span className="text-foreground">{phoneLabel}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Fulfillment: <span className="text-foreground">{fulfillmentLabel}</span>
                        {" · "}
                        {etaLabel ? (
                          <>
                            ETA <span className="text-foreground">{etaLabel}</span>
                          </>
                        ) : (
                          "ETA pending"
                        )}
                      </p>
                      {shippingAddressLines ? (
                        <p className="text-[11px] text-muted-foreground">
                          Shipping address:{" "}
                          <span className="mt-1 block whitespace-pre-wrap break-words font-mono text-foreground">
                            {shippingAddressLabel}
                          </span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-amber-800">
                          Shipping address unavailable.
                        </p>
                      )}
                      {partialAddress ? (
                        <p className="text-[11px] text-amber-800">
                          Stripe returned a partial shipping address for this
                          order (street line missing).
                        </p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground">
                        {purchase.trackingUrl ? (
                          <a
                            href={purchase.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium underline underline-offset-2"
                          >
                            Track shipment
                          </a>
                        ) : purchase.trackingNumber ? (
                          <>
                            Tracking:{" "}
                            <span className="font-mono text-foreground">
                              {purchase.trackingNumber}
                            </span>
                          </>
                        ) : (
                          "Tracking pending"
                        )}
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
                );
              })
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

