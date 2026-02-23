import { NextResponse } from "next/server";

import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { claimLinketProOfferForAssignment } from "@/lib/linket-tags";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";

type ClaimProOfferPayload = {
  assignmentId?: string;
};

export async function POST(request: Request) {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json(
      { error: "Linkets service is not configured." },
      { status: 500 }
    );
  }

  const supabase = await createServerSupabaseReadonly();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | ClaimProOfferPayload
    | null;
  const assignmentId = body?.assignmentId?.trim();
  if (!assignmentId) {
    return NextResponse.json(
      { error: "assignmentId is required." },
      { status: 400 }
    );
  }

  try {
    const result = await claimLinketProOfferForAssignment({
      assignmentId,
      userId: user.id,
    });

    if (result.status === "already_claimed_by_other") {
      return NextResponse.json(
        {
          error:
            "This Linket's free 12 months of Pro has already been claimed.",
          status: result.status,
          tagId: result.tagId,
          claimedAt: result.claimedAt,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      tagId: result.tagId,
      claimedAt: result.claimedAt,
      entitlementEndsAt: result.entitlementEndsAt,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to claim Linket Pro offer.";

    if (message.toLowerCase().includes("not authorized")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.toLowerCase().includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
