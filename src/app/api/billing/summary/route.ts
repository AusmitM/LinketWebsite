import { NextResponse } from "next/server";

import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import {
  getBillingSummaryForUser,
  markInAppPromptShown,
} from "@/lib/billing/entitlements";

export async function GET() {
  try {
    const supabase = await createServerSupabaseReadonly();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await getBillingSummaryForUser(user.id, supabase as any);

    if (
      summary.renewalPrompt.shouldShow &&
      summary.entitlement?.id &&
      !summary.entitlement.inAppPromptedAt
    ) {
      void markInAppPromptShown(summary.entitlement.id);
    }

    return NextResponse.json(summary, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load billing summary.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
