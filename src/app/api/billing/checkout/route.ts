import { NextResponse } from "next/server";

import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { isCheckoutPlanKey } from "@/lib/billing/plans";
import { getProDiscountEligibilityForUser } from "@/lib/billing/entitlements";
import type { CheckoutRequest, CheckoutResponse } from "@/types/billing";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseReadonly();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Partial<CheckoutRequest>;
    if (!body.planKey || !isCheckoutPlanKey(body.planKey)) {
      return NextResponse.json({ error: "Invalid planKey." }, { status: 400 });
    }
    const source = body.source === "landing" ? "landing" : "dashboard";
    const proDiscountEligibility = await getProDiscountEligibilityForUser(
      user.id,
      supabase
    );

    const session = await createCheckoutSession({
      userId: user.id,
      userEmail: user.email ?? null,
      planKey: body.planKey,
      source,
      discountEligibleForPro: proDiscountEligibility.eligible,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe checkout URL was not returned." },
        { status: 500 }
      );
    }

    const payload: CheckoutResponse = { url: session.url };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create checkout session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
