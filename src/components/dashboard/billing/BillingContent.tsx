import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BrandedCardEntry from "@/components/dashboard/billing/BrandedCardEntry";
import BillingStripeActionButton from "@/components/dashboard/billing/BillingStripeActionButton";
import BillingTransientStateCleaner from "@/components/dashboard/billing/BillingTransientStateCleaner";
import BundlePaymentStatusPoller from "@/components/dashboard/billing/BundlePaymentStatusPoller";
import RemovePaymentMethodButton from "@/components/dashboard/billing/RemovePaymentMethodButton";
import SetDefaultPaymentMethodButton from "@/components/dashboard/billing/SetDefaultPaymentMethodButton";
import type {
  DashboardBillingData,
  DashboardBillingInvoice,
  DashboardBillingPaymentMethod,
} from "@/lib/billing/dashboard";
import {
  formatMonthly,
  formatYearly,
  type MonthlyYearlyRate,
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

function formatDateRange(start: string | null, end: string | null) {
  const startLabel = formatIsoDate(start);
  const endLabel = formatIsoDate(end);
  if (startLabel && endLabel) return `${startLabel} to ${endLabel}`;
  return startLabel ?? endLabel ?? null;
}

function toTimestampMs(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function sortByDateDesc<T>(
  items: T[],
  pickDate: (item: T) => string | null | undefined
) {
  return [...items].sort((left, right) => {
    const rightTime = toTimestampMs(pickDate(right)) ?? 0;
    const leftTime = toTimestampMs(pickDate(left)) ?? 0;
    return rightTime - leftTime;
  });
}

function formatCardBrand(value: string | null | undefined) {
  if (!value) return "Card";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatPaymentMethodLabel(
  paymentMethod: DashboardBillingPaymentMethod | null | undefined
) {
  if (!paymentMethod) return "No card on file";
  return `${formatCardBrand(paymentMethod.brand)} ending in ${
    paymentMethod.last4 ?? "----"
  }`;
}

function formatPaymentMethodExpiry(
  month: number | null,
  year: number | null
) {
  if (!month || !year) return "--/--";
  return `${String(month).padStart(2, "0")}/${year}`;
}

function inferRenewalRateLabel(
  hints: Array<string | null | undefined>,
  initialRate: MonthlyYearlyRate,
  fallbackLabel: string
) {
  const joined = hints.map((value) => value?.toLowerCase() ?? "").join(" ");
  if (joined.includes("year")) return formatYearly(initialRate.yearly);
  if (joined.includes("month")) return formatMonthly(initialRate.monthly);
  return fallbackLabel;
}

function getInvoiceAmountMinor(invoice: DashboardBillingInvoice) {
  return invoice.amountPaidMinor > 0
    ? invoice.amountPaidMinor
    : invoice.amountDueMinor;
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
  const cityState = [parts.city, parts.state].filter(Boolean).join(", ");
  if (!cityState && !parts.postalCode) return null;
  if (!cityState) return parts.postalCode;
  if (!parts.postalCode) return cityState;
  return `${cityState} ${parts.postalCode}`;
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
  const initialRateLabel = `${formatMonthly(initialRate.monthly)} or ${formatYearly(
    initialRate.yearly
  )}`;
  const loyaltyRateLabel = `${formatMonthly(loyaltyRate.monthly)} or ${formatYearly(
    loyaltyRate.yearly
  )}`;

  const summary = billingData?.summary ?? null;
  const subscription = billingData?.subscription ?? null;
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
  const sortedPaymentMethods = [...paymentMethods].sort(
    (left, right) => Number(right.isDefault) - Number(left.isDefault)
  );
  const defaultPaymentMethod =
    sortedPaymentMethods.find((paymentMethod) => paymentMethod.isDefault) ??
    sortedPaymentMethods[0] ??
    null;
  const sortedInvoices = sortByDateDesc(
    invoices,
    (invoice) => invoice.createdAt ?? invoice.periodEnd ?? invoice.periodStart
  );
  const sortedBundlePurchases = sortByDateDesc(
    bundlePurchases,
    (purchase) => purchase.purchasedAt ?? purchase.createdAt
  );
  const sortedPeriods = sortByDateDesc(
    periods,
    (period) => period.periodStart ?? period.createdAt
  );
  const planName = summary?.planName ?? "No plan on file";
  const accessThroughDate = complimentaryWindow?.active
    ? complimentaryWindow.endsAt
    : summary?.renewsOn ?? summary?.currentPeriodEnd ?? null;
  const accessThroughLabel = formatIsoDate(accessThroughDate);
  const billingCycleLabel = formatDateRange(
    summary?.currentPeriodStart ?? null,
    summary?.currentPeriodEnd ?? null
  );
  const autoRenewLabel =
    summary?.autoRenews === null ? "Unknown" : summary?.autoRenews ? "On" : "Off";
  const paymentMethodSummaryLabel = formatPaymentMethodLabel(defaultPaymentMethod);
  const renewalRateLabel = inferRenewalRateLabel(
    [subscription?.priceNickname, subscription?.planName, summary?.planName],
    initialRate,
    initialRateLabel
  );
  const stripeCustomerId = summary?.customerId ?? billingData?.stripe.customerId ?? null;

  let billingStatusLabel = summary ? formatStatus(summary.status) : "Not set up";
  if (complimentaryWindow?.active) billingStatusLabel = "Active";
  if (activeBillingWarning || fallbackSubscriptionRiskWarning) {
    billingStatusLabel = "Needs attention";
  }

  let billingStatusCopy =
    "Status first, actions second, history last, and raw Stripe data only on demand.";
  if (complimentaryWindow?.active && complimentaryEndsLabel) {
    billingStatusCopy = `Complimentary Pro is active through ${complimentaryEndsLabel}. Billing is paused until complimentary access ends.`;
  } else if (
    hasUpcomingComplimentaryWindow &&
    complimentaryStartsLabel &&
    complimentaryEndsLabel
  ) {
    billingStatusCopy = `Complimentary Pro begins on ${complimentaryStartsLabel} and continues through ${complimentaryEndsLabel}.`;
  } else if (summary?.autoRenews === false && accessThroughLabel) {
    billingStatusCopy = `Your plan will end on ${accessThroughLabel} and will not renew automatically.`;
  } else if (summary?.autoRenews && accessThroughLabel) {
    billingStatusCopy = `Your plan stays active through ${accessThroughLabel} while auto-renew remains on.`;
  } else if (summary) {
    billingStatusCopy = "Billing details are active and update automatically from Stripe.";
  }

  let nextChargeLabel = "No charge scheduled";
  let nextChargeAmountLabel = "$0";
  let nextChargeStatusLabel = "No future charge is scheduled";
  let nextChargeReason =
    "Add a payment method when you are ready. Stripe fields load only on demand.";
  if (complimentaryWindow?.active && complimentaryEndsLabel) {
    nextChargeLabel = `No charge until ${complimentaryEndsLabel}`;
    nextChargeStatusLabel = "Billing is paused";
    nextChargeReason = `Complimentary Pro is active through ${complimentaryEndsLabel}.`;
  } else if (hasUpcomingComplimentaryWindow && complimentaryStartsLabel) {
    nextChargeLabel = complimentaryStartsLabel;
    nextChargeStatusLabel = "Complimentary access scheduled";
    nextChargeReason = `Complimentary Pro begins on ${complimentaryStartsLabel} at the next renewal boundary.`;
  } else if (summary?.autoRenews === false) {
    nextChargeLabel = "None scheduled";
    nextChargeStatusLabel = "Auto-renew is off";
    nextChargeReason =
      accessThroughLabel !== null
        ? `Service access remains active through ${accessThroughLabel}.`
        : "Your plan will not renew until auto-renew is turned back on.";
  } else if (summary?.renewsOn) {
    nextChargeLabel = formatIsoDate(summary.renewsOn) ?? "Scheduled";
    nextChargeAmountLabel = renewalRateLabel;
    nextChargeStatusLabel = "Auto-renew is on";
    nextChargeReason =
      "Your plan is set to renew automatically while your current billing setup remains active.";
  } else if (hasManageableSubscription) {
    nextChargeLabel = "Stripe will confirm after the next sync";
    nextChargeAmountLabel = renewalRateLabel;
    nextChargeStatusLabel = "Subscription active";
    nextChargeReason = "Manage your plan in Stripe to confirm upcoming charges.";
  }

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
              <BillingStripeActionButton
                size="sm"
                className={BILLING_PRIMARY_BUTTON_CLASS}
                href={subscribeMonthlyHref}
                idleLabel="Continue monthly checkout"
              />
            )}
          </div>
        </div>
      ) : null}

      <section id="billing-summary">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl font-semibold">{planName}</CardTitle>
                <Badge variant="secondary" className="rounded-full">
                  {billingStatusLabel}
                </Badge>
                {complimentaryWindow?.active ? (
                  <Badge variant="outline" className="rounded-full">
                    Complimentary access
                  </Badge>
                ) : null}
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {billingStatusCopy}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManageBilling ? (
                <BillingStripeActionButton
                  size="sm"
                  className={BILLING_PRIMARY_BUTTON_CLASS}
                  href={planActionHref}
                  idleLabel={hasManageableSubscription ? "Manage plan" : "Start paid plan"}
                />
              ) : (
                <Button
                  size="sm"
                  className={BILLING_PRIMARY_BUTTON_CLASS}
                  disabled
                >
                  Billing portal unavailable
                </Button>
              )}
              <Button
                asChild
                size="sm"
                variant="outline"
                className={BILLING_SECONDARY_BUTTON_CLASS}
              >
                <a href="#payment-methods">Add payment method</a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryFact label="Current plan" value={planName} />
              <SummaryFact label="Access through" value={accessThroughLabel ?? "--"} />
              <SummaryFact label="Next charge" value={nextChargeLabel} />
              <SummaryFact label="Auto-renew" value={autoRenewLabel} />
              <SummaryFact
                label="Payment method"
                value={paymentMethodSummaryLabel}
              />
              <SummaryFact label="Billing status" value={nextChargeStatusLabel} />
            </div>
            {billingCycleLabel ? (
              <div className="rounded-2xl border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Stripe billing cycle:</span>{" "}
                {billingCycleLabel}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section id="payment-methods">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">Payment methods</CardTitle>
              <p className="text-sm text-muted-foreground">
                Keep cards near the top of the page so card management is one scan
                away. Secure Stripe fields load only after you choose to add one.
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
            {sortedPaymentMethods.length === 0 ? (
              <p className="rounded-2xl border p-3 text-sm text-muted-foreground">
                No card details available for this account yet.
              </p>
            ) : (
              <div className="space-y-3">
                {sortedPaymentMethods.map((paymentMethod) => (
                  <div
                    key={paymentMethod.id}
                    className="flex flex-col gap-4 rounded-2xl border bg-card/60 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {formatPaymentMethodLabel(paymentMethod)}
                        </p>
                        <Badge
                          variant={paymentMethod.isDefault ? "outline" : "secondary"}
                          className="rounded-full"
                        >
                          {paymentMethod.isDefault ? "Default" : "Backup"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Expires{" "}
                        {formatPaymentMethodExpiry(
                          paymentMethod.expMonth,
                          paymentMethod.expYear
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!paymentMethod.isDefault ? (
                        <SetDefaultPaymentMethodButton
                          paymentMethodId={paymentMethod.id}
                        />
                      ) : null}
                      <RemovePaymentMethodButton
                        paymentMethodId={paymentMethod.id}
                        isDefault={paymentMethod.isDefault}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Technical payment method references are kept in Support and technical
              references at the bottom of the page.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card id="plan-details" className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">Plan details</CardTitle>
              <p className="text-sm text-muted-foreground">
                Plain-language plan status, timing, and billing provider details.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Plan name" value={planName} />
              <DetailItem label="Access through" value={accessThroughLabel ?? "--"} />
              <DetailItem
                label="Billing cycle"
                value={billingCycleLabel ?? "No active cycle recorded yet"}
              />
              <DetailItem label="Auto-renew" value={autoRenewLabel} />
              <DetailItem
                label="Payments"
                value={stripeEnabled ? "Powered by Stripe" : "Stripe unavailable"}
              />
              <DetailItem
                label="Complimentary status"
                value={
                  complimentaryWindow?.active
                    ? `Active through ${complimentaryEndsLabel ?? "--"}`
                    : hasUpcomingComplimentaryWindow
                      ? `Starts ${complimentaryStartsLabel ?? "--"}`
                      : "Not active"
                }
              />
            </div>

            {complimentaryWindow?.active ? (
              <p className="rounded-2xl border border-emerald-300 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                Complimentary Pro is active through {complimentaryEndsLabel ?? "--"}.
                {typeof complimentaryWindow.daysRemaining === "number"
                  ? ` ${complimentaryWindow.daysRemaining} day${
                      complimentaryWindow.daysRemaining === 1 ? "" : "s"
                    } remaining.`
                  : ""}
              </p>
            ) : hasUpcomingComplimentaryWindow ? (
              <p className="rounded-2xl border border-blue-300 bg-blue-50/60 px-4 py-3 text-sm text-blue-950">
                Complimentary Pro begins on {complimentaryStartsLabel ?? "--"} and
                continues through {complimentaryEndsLabel ?? "--"}.
              </p>
            ) : summary?.autoRenews === false ? (
              <p className="rounded-2xl border border-amber-300 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                Your plan will end on {accessThroughLabel ?? "--"} and will not
                renew automatically.
              </p>
            ) : summary ? (
              <p className="rounded-2xl border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
                Your plan renews automatically while auto-renew remains on.
              </p>
            ) : (
              <p className="rounded-2xl border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
                Billing data is not available yet for this account.
              </p>
            )}

            {canManageBilling && hasManageableSubscription ? (
              summary?.autoRenews !== false ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-4 text-sm text-amber-900">
                  <p className="font-semibold">Need to stop future payments?</p>
                  <p className="mt-1">
                    You can turn off renewal anytime. Access stays active through{" "}
                    {accessThroughLabel ?? "the end of the current billing cycle"}.
                  </p>
                  <form
                    action={cancelSubscriptionActionHref}
                    method="post"
                    className="mt-3"
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
                <p className="rounded-2xl border border-amber-300 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                  Your plan will end on {accessThroughLabel ?? "--"} and will not
                  renew automatically.
                </p>
              )
            ) : canManageBilling ? (
              <div className="rounded-2xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">
                  Ready to start paid billing?
                </p>
                <p className="mt-1">
                  Choose monthly or yearly to activate your paid Pro plan.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <BillingStripeActionButton
                    size="sm"
                    variant="outline"
                    className={BILLING_SECONDARY_BUTTON_CLASS}
                    href={subscribeMonthlyHref}
                    idleLabel="Choose monthly"
                  />
                  <BillingStripeActionButton
                    size="sm"
                    variant="outline"
                    className={BILLING_SECONDARY_BUTTON_CLASS}
                    href={subscribeYearlyHref}
                    idleLabel="Choose yearly"
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card id="upcoming-charges" className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">Upcoming charges</CardTitle>
              <p className="text-sm text-muted-foreground">
                Answer the main question directly: will you be charged soon?
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Next charge" value={nextChargeLabel} />
              <DetailItem label="Next charge amount" value={nextChargeAmountLabel} />
              <DetailItem label="Billing status" value={nextChargeStatusLabel} />
              <DetailItem
                label="Future renewal rate"
                value={`${renewalRateLabel} now, ${loyaltyRateLabel} after ${requiredPaidDays} paid days`}
              />
            </div>

            <div className="space-y-3 rounded-2xl border bg-card/40 p-4 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Reason:</span>{" "}
                {nextChargeReason}
              </p>
              <p>
                <span className="font-semibold text-foreground">After that:</span>{" "}
                Renewals drop from {renewalRateLabel} to {loyaltyRateLabel} after{" "}
                {requiredPaidDays} cumulative paid days.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="loyalty-discount">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">
                Loyalty discount
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                A simple progress view instead of a long explanation.
              </p>
            </div>
            <Badge
              variant={loyaltyEligible ? "secondary" : "outline"}
              className="rounded-full"
            >
              {!hasLoyaltyStatus
                ? "Unavailable"
                : complimentaryWindow?.active
                  ? "Paused"
                  : loyaltyEligible
                    ? "Active"
                    : "Pending"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
              <div className="rounded-2xl border bg-card/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">
                    Progress to loyalty pricing
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {totalPaidDays} of {requiredPaidDays} paid days
                  </p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${loyaltyProgressPercent}%` }}
                  />
                </div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {complimentaryWindow?.active ? (
                    <p>
                      Paused until {complimentaryEndsLabel ?? "--"}. Paid-day
                      progress resumes after complimentary access ends.
                    </p>
                  ) : loyaltyEligible ? (
                    <p>Loyalty pricing is already active for future renewals.</p>
                  ) : loyaltyEligibleOnLabel ? (
                    <p>
                      Estimated eligibility: {loyaltyEligibleOnLabel}
                      {typeof loyaltyDaysUntilEligible === "number"
                        ? ` (${loyaltyDaysUntilEligible} day${
                            loyaltyDaysUntilEligible === 1 ? "" : "s"
                          } remaining).`
                        : "."}
                    </p>
                  ) : (
                    <p>
                      Paid time is cumulative, so canceled and restarted paid
                      periods still count.
                    </p>
                  )}
                  {!hasLoyaltyStatus ? (
                    <p className="text-amber-900">
                      Loyalty status is temporarily unavailable. Refresh billing
                      details in a moment.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3">
                <DetailItem label="Current renewal rate" value={renewalRateLabel} />
                <DetailItem label="Loyalty renewal rate" value={loyaltyRateLabel} />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="orders-shipping">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">
                Orders & shipping
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Keep physical product orders separate from subscription billing.
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
          <CardContent className="space-y-3">
            {sortedBundlePurchases.length === 0 ? (
              <p className="rounded-2xl border p-3 text-sm text-muted-foreground">
                No bundle orders recorded yet.
              </p>
            ) : (
              sortedBundlePurchases.map((purchase) => {
                const orderDateLabel =
                  formatIsoDate(purchase.purchasedAt) ??
                  formatIsoDate(purchase.createdAt) ??
                  "--";
                const shippingAddressLines = formatShippingAddressLines(
                  purchase.shippingAddress
                );
                const estimatedDeliveryLabel =
                  formatIsoDate(purchase.estimatedDeliveryDate) ??
                  purchase.estimatedDeliveryDate;
                const partialAddress =
                  Boolean(shippingAddressLines) &&
                  !hasStreetAddress(purchase.shippingAddress);

                return (
                  <div
                    key={purchase.id}
                    className="rounded-2xl border bg-card/60 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">
                            Linket Bundle x{purchase.quantity}
                          </p>
                          <Badge variant="secondary" className="rounded-full">
                            {formatStatus(purchase.purchaseStatus)}
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            {purchase.fulfillmentStatus
                              ? formatStatus(purchase.fulfillmentStatus)
                              : "Pending"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Ordered {orderDateLabel} |{" "}
                          {formatMinorAmount(purchase.totalMinor, purchase.currency)} total
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Tracking status:{" "}
                          {purchase.trackingUrl
                            ? "Tracking link available"
                            : purchase.trackingNumber
                              ? "Tracking number available"
                              : "Tracking pending"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {purchase.trackingUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="rounded-full"
                          >
                            <a
                              href={purchase.trackingUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Track package
                            </a>
                          </Button>
                        ) : null}
                        {purchase.receiptUrl ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="rounded-full"
                          >
                            <a
                              href={purchase.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Receipt
                            </a>
                          </Button>
                        ) : (
                          <span className="inline-flex items-center text-xs text-muted-foreground">
                            Receipt pending
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <DetailItem
                        label="Product"
                        value={
                          purchase.quantity === 1
                            ? "Linket Bundle"
                            : `Linket Bundle x${purchase.quantity}`
                        }
                      />
                      <DetailItem
                        label="Order total"
                        value={formatMinorAmount(
                          purchase.totalMinor,
                          purchase.currency
                        )}
                      />
                      <DetailItem label="Order date" value={orderDateLabel} />
                      <DetailItem
                        label="Tracking"
                        value={
                          purchase.trackingNumber
                            ? purchase.trackingNumber
                            : purchase.trackingUrl
                              ? "Tracking link available"
                              : "Pending"
                        }
                      />
                    </div>

                    <details className="mt-4 rounded-2xl border bg-background/70 p-4">
                      <summary className="cursor-pointer list-none font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                        Shipping and order details
                      </summary>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>
                            <span className="font-semibold text-foreground">
                              Recipient:
                            </span>{" "}
                            {purchase.shippingName ?? "Not provided"}
                          </p>
                          <p>
                            <span className="font-semibold text-foreground">
                              Phone:
                            </span>{" "}
                            {purchase.shippingPhone ?? "Not provided"}
                          </p>
                          <p>
                            <span className="font-semibold text-foreground">
                              Estimated delivery:
                            </span>{" "}
                            {estimatedDeliveryLabel ?? "Pending"}
                          </p>
                          <p>
                            <span className="font-semibold text-foreground">
                              Order status:
                            </span>{" "}
                            {formatStatus(purchase.orderStatus)}
                          </p>
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p className="font-semibold text-foreground">
                            Shipping address
                          </p>
                          {shippingAddressLines ? (
                            <div className="rounded-2xl border bg-card/50 p-3 font-mono text-xs text-foreground">
                              {shippingAddressLines.map((line) => (
                                <div key={line}>{line}</div>
                              ))}
                            </div>
                          ) : (
                            <p>Shipping address unavailable.</p>
                          )}
                          {partialAddress ? (
                            <p className="text-amber-900">
                              Stripe returned a partial shipping address for this
                              order.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

      <section id="invoices">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">Invoices</CardTitle>
              <p className="text-sm text-muted-foreground">
                Receipts and charge status in a clean scan-friendly table.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {sortedInvoices.length === 0 ? (
              <p className="rounded-2xl border p-3 text-sm text-muted-foreground">
                No invoices available yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border">
                <table className="min-w-[640px] w-full text-left text-sm">
                  <thead className="bg-card/60 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Invoice</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInvoices.map((invoice) => {
                      const invoiceLink =
                        invoice.hostedInvoiceUrl ?? invoice.invoicePdfUrl;
                      const invoiceDateLabel =
                        formatIsoDate(invoice.createdAt) ??
                        formatIsoDate(invoice.periodEnd) ??
                        "--";

                      return (
                        <tr key={invoice.id} className="border-t bg-background/80">
                          <td className="px-4 py-3 font-medium text-foreground">
                            {invoice.number ?? maskMiddle(invoice.id) ?? invoice.id}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {invoiceDateLabel}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {formatMinorAmount(
                              getInvoiceAmountMinor(invoice),
                              invoice.currency
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="rounded-full">
                              {formatStatus(invoice.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {invoiceLink ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="rounded-full"
                              >
                                <a href={invoiceLink} target="_blank" rel="noreferrer">
                                  View
                                </a>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No receipt
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="billing-history">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">
                Billing history
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Recorded billing activity in a simple timeline.
              </p>
            </div>
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

            {sortedPeriods.length === 0 ? (
              <p className="rounded-2xl border p-3 text-sm text-muted-foreground">
                No Stripe billing periods recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {sortedPeriods.map((period) => (
                  <div
                    key={period.id}
                    className="rounded-2xl border bg-card/50 p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">
                        {formatDateRange(period.periodStart, period.periodEnd) ?? "--"}
                      </p>
                      <Badge variant="outline" className="rounded-full">
                        {formatStatus(period.status)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {formatIsoDate(period.createdAt)
                        ? `Recorded on ${formatIsoDate(period.createdAt)}.`
                        : "Recorded billing activity from Stripe."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="support-references">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">
                Support and technical references
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Raw Stripe identifiers stay hidden by default. Only share these
                with Linket support.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <details className="rounded-2xl border bg-card/40 p-4">
              <summary className="cursor-pointer list-none font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                Show technical references
              </summary>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <div className="rounded-2xl border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Subscription reference
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-foreground">
                    {summary?.activeSubscriptionId ?? "Not available yet"}
                  </p>
                </div>
                <div className="rounded-2xl border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Billing profile reference
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-foreground">
                    {stripeCustomerId ?? "Not available yet"}
                  </p>
                </div>
                <div className="rounded-2xl border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Payment method references
                  </p>
                  {sortedPaymentMethods.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No payment method references yet.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {sortedPaymentMethods.map((paymentMethod) => (
                        <div
                          key={paymentMethod.id}
                          className="rounded-2xl border bg-card/50 p-3"
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {formatPaymentMethodLabel(paymentMethod)}
                            {paymentMethod.isDefault ? " (default)" : ""}
                          </p>
                          <p className="mt-2 break-all font-mono text-xs text-foreground">
                            {paymentMethod.id}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Order and checkout references
                  </p>
                  {sortedBundlePurchases.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No bundle order references yet.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {sortedBundlePurchases.map((purchase) => (
                        <div
                          key={purchase.id}
                          className="rounded-2xl border bg-card/50 p-3"
                        >
                          <p className="text-sm font-semibold text-foreground">
                            Order {maskMiddle(purchase.id) ?? purchase.id}
                          </p>
                          <div className="mt-2 space-y-1 font-mono text-xs text-foreground">
                            <div className="break-all">
                              Checkout session: {purchase.checkoutSessionId || "--"}
                            </div>
                            <div className="break-all">
                              Payment intent: {purchase.paymentIntentId ?? "--"}
                            </div>
                            <div className="break-all">
                              Invoice: {purchase.invoiceId ?? "--"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Stripe sync warnings
                  </p>
                  {stripeErrors.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No Stripe sync warnings right now.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm text-amber-900">
                      {stripeErrors.map((message) => (
                        <li key={message} className="rounded-2xl border bg-amber-50/70 p-3">
                          {message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-2xl border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Billing period references
                  </p>
                  {sortedPeriods.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No billing period references yet.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {sortedPeriods.map((period) => (
                        <div
                          key={period.id}
                          className="rounded-2xl border bg-card/50 p-3"
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {formatDateRange(period.periodStart, period.periodEnd) ??
                              maskMiddle(period.id) ??
                              period.id}
                          </p>
                          <div className="mt-2 space-y-1 font-mono text-xs text-foreground">
                            <div className="break-all">
                              Subscription: {period.subscriptionId}
                            </div>
                            <div className="break-all">
                              Customer: {period.customerId ?? "--"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
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
