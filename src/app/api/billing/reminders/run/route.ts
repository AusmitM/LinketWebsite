import { NextResponse } from "next/server";

import { runBundleRenewalReminderSweep } from "@/lib/billing/reminders";
import { isValidInternalSecret } from "@/lib/security";

export async function POST(request: Request) {
  const internalSecret = request.headers.get("x-internal-secret");
  if (!isValidInternalSecret(internalSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBundleRenewalReminderSweep();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to execute reminder sweep.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

