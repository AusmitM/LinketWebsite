import BillingContent from "@/components/dashboard/billing/BillingContent";
import { getDashboardBillingDataForUser } from "@/lib/billing/dashboard";
import { getPersonalProLoyaltyStatusForUser } from "@/lib/billing/loyalty";
import {
  buildDefaultPersonalProLoyaltyStatus,
  getPublicPricingSnapshot,
} from "@/lib/billing/pricing";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";

export const metadata = {
  title: "Billing",
};

type SearchParamValue = string | string[] | undefined;
type SearchParamsRecord = Record<string, SearchParamValue>;
type BillingPageProps = {
  searchParams?: SearchParamsRecord | Promise<SearchParamsRecord>;
};

function readSearchParam(value: SearchParamValue) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

async function resolveSearchParams(
  value: BillingPageProps["searchParams"]
): Promise<SearchParamsRecord> {
  if (!value) return {};
  if (typeof (value as Promise<SearchParamsRecord>).then === "function") {
    return (await value) ?? {};
  }
  return value;
}

function toCheckoutStatus(
  value: string | null
): "success" | "cancel" | "incomplete" | null {
  if (value === "success" || value === "cancel" || value === "incomplete") {
    return value;
  }
  return null;
}

function toCheckoutPurchase(value: string | null): "bundle" | null {
  if (value === "bundle") return "bundle";
  return null;
}

function toBillingIntent(
  value: string | null
): "bundle" | "pro_monthly" | "pro_yearly" | null {
  if (value === "bundle" || value === "pro_monthly" || value === "pro_yearly") {
    return value;
  }
  return null;
}

function toSubscriptionNotice(value: string | null): "cancel_scheduled" | null {
  if (value === "cancel_scheduled") return value;
  return null;
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await resolveSearchParams(searchParams);
  const checkoutStatus = toCheckoutStatus(readSearchParam(params.checkout));
  const checkoutPurchase = toCheckoutPurchase(readSearchParam(params.purchase));
  const billingErrorCode = readSearchParam(params.billingError);
  const billingIntent = toBillingIntent(readSearchParam(params.intent));
  const subscriptionNotice = toSubscriptionNotice(
    readSearchParam(params.subscription)
  );

  const supabase = await createServerSupabaseReadonly();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let personalProLoyalty = buildDefaultPersonalProLoyaltyStatus();
  let billingData = null;

  if (user?.id) {
    try {
      personalProLoyalty = await getPersonalProLoyaltyStatusForUser(user.id);
    } catch (error) {
      console.error("Billing page loyalty lookup failed:", error);
    }

    try {
      billingData = await getDashboardBillingDataForUser(user.id, {
        email: user.email ?? null,
      });
    } catch (error) {
      console.error("Billing page billing data lookup failed:", error);
    }
  }

  return (
    <BillingContent
      pricing={getPublicPricingSnapshot()}
      personalProLoyalty={personalProLoyalty}
      billingData={billingData}
      checkoutStatus={checkoutStatus}
      checkoutPurchase={checkoutPurchase}
      billingErrorCode={billingErrorCode}
      billingIntent={billingIntent}
      subscriptionNotice={subscriptionNotice}
    />
  );
}
