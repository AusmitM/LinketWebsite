import BillingContent from "@/components/dashboard/billing/BillingContent";
import { getPersonalProLoyaltyStatusForUser } from "@/lib/billing/loyalty";
import {
  buildDefaultPersonalProLoyaltyStatus,
  getPublicPricingSnapshot,
} from "@/lib/billing/pricing";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";

export const metadata = {
  title: "Billing",
};

export default async function BillingPage() {
  const supabase = await createServerSupabaseReadonly();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let personalProLoyalty = buildDefaultPersonalProLoyaltyStatus();
  if (user?.id) {
    try {
      personalProLoyalty = await getPersonalProLoyaltyStatusForUser(user.id);
    } catch (error) {
      console.error("Billing page loyalty lookup failed:", error);
    }
  }

  return (
    <BillingContent
      pricing={getPublicPricingSnapshot()}
      personalProLoyalty={personalProLoyalty}
    />
  );
}
