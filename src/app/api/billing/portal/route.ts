import { NextResponse } from "next/server";

import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { createBillingPortalSession } from "@/lib/billing/stripe";
import type { PortalResponse } from "@/types/billing";

export async function POST() {
  try {
    const supabase = await createServerSupabaseReadonly();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await createBillingPortalSession({
      userId: user.id,
      userEmail: user.email ?? null,
    });

    const payload: PortalResponse = { url: session.url };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create billing portal session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

