import { NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildDefaultPersonalProLoyaltyStatus,
  getPublicPricingSnapshot,
} from "@/lib/billing/pricing";
import { getPersonalProLoyaltyStatusForUser } from "@/lib/billing/loyalty";

export const dynamic = "force-dynamic";

export async function GET() {
  const pricing = getPublicPricingSnapshot();
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      pricing,
      personalProLoyalty: null,
    });
  }

  let personalProLoyalty = buildDefaultPersonalProLoyaltyStatus();
  try {
    personalProLoyalty = await getPersonalProLoyaltyStatusForUser(user.id);
  } catch (error) {
    console.error("Billing pricing API loyalty lookup failed:", error);
  }

  return NextResponse.json({
    pricing,
    personalProLoyalty,
  });
}
