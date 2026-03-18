import { NextRequest, NextResponse } from "next/server";

import { requireRouteAccess } from "@/lib/api-authorization";
import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { isTrustedRequestOrigin } from "@/lib/http-origin";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const access = await requireRouteAccess("POST /api/billing/setup-intent");
  if (access instanceof NextResponse) {
    return access;
  }
  const user = access.user;

  if (!getStripeSecretKey()) {
    return NextResponse.json(
      { error: "Billing backend unavailable" },
      { status: 503 }
    );
  }

  try {
    const customerId = await getOrCreateStripeCustomerForUser({
      userId: user.id,
      email: user.email ?? null,
      fullName:
        (user.user_metadata?.full_name as string | null | undefined) ??
        (user.user_metadata?.name as string | null | undefined) ??
        null,
      firstName:
        (user.user_metadata?.first_name as string | null | undefined) ?? null,
      lastName:
        (user.user_metadata?.last_name as string | null | undefined) ?? null,
    });
    if (!customerId) {
      return NextResponse.json(
        { error: "Unable to initialize billing customer" },
        { status: 500 }
      );
    }

    const stripe = getStripeServerClient();
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: {
        user_id: user.id,
        supabase_user_id: user.id,
        source: "dashboard_billing_custom_card_entry",
      },
    });

    if (!setupIntent.client_secret) {
      return NextResponse.json(
        { error: "Missing setup intent client secret" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId,
    });
  } catch (error) {
    console.error("Stripe setup intent creation failed:", error);
    return NextResponse.json(
      { error: "Unable to initialize card entry" },
      { status: 500 }
    );
  }
}
