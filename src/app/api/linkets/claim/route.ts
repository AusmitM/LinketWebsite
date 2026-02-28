import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ensureNoChargeDuringComplimentary,
  pickManageableSubscriptionId,
} from "@/lib/billing/complimentary-subscription";
import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { getLinketBundleComplimentaryWindowForUser } from "@/lib/billing/linket-bundle";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { getActiveProfileForUser } from "@/lib/profile-service";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

type ClaimPayload = {
  userId?: string;
  chipUid?: string;
  claimCode?: string;
  profileId?: string | null;
  nickname?: string | null;
};

const CLAIMABLE_STATUSES = new Set(["unclaimed", "claimable"]);

function normalizeClaimCode(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function buildClaimLookupCandidates(value: string) {
  const upper = normalizeClaimCode(value);
  const lower = upper.toLowerCase();
  return {
    upper,
    lower,
  };
}

export async function POST(req: NextRequest) {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json(
      { error: "Linkets service is not configured." },
      { status: 500 }
    );
  }

  const supabase = await createServerSupabaseReadonly();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as ClaimPayload | null;
  const rawCode = payload?.chipUid ?? payload?.claimCode ?? "";
  const candidates = buildClaimLookupCandidates(rawCode || "");
  if (!candidates.upper) {
    return NextResponse.json({ error: "Claim code is required." }, { status: 400 });
  }

  const now = new Date().toISOString();
  let tagId: string | null = null;

  const { data: claimTag, error: claimTagError } = await supabaseAdmin
    .from("hardware_tags")
    .select("id,status")
    .or(`claim_code.eq.${candidates.upper},claim_code.eq.${candidates.lower}`)
    .maybeSingle();
  if (claimTagError) {
    return NextResponse.json({ error: claimTagError.message }, { status: 500 });
  }

  if (claimTag) {
    if (!CLAIMABLE_STATUSES.has(claimTag.status)) {
      return NextResponse.json(
        { error: "Tag is already claimed or unavailable." },
        { status: 409 }
      );
    }
    const { error: updateError } = await supabaseAdmin
      .from("hardware_tags")
      .update({ status: "claimed", last_claimed_at: now })
      .eq("id", claimTag.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    tagId = claimTag.id;
  } else {
    const { data: tokenTag, error: tokenError } = await supabaseAdmin
      .from("hardware_tags")
      .select("id,status")
      .or(
        `chip_uid.eq.${candidates.upper},chip_uid.eq.${candidates.lower},public_token.eq.${candidates.upper},public_token.eq.${candidates.lower}`
      )
      .maybeSingle();
    if (tokenError) {
      return NextResponse.json({ error: tokenError.message }, { status: 500 });
    }
    if (!tokenTag) {
      return NextResponse.json(
        { error: "Claim code not found." },
        { status: 404 }
      );
    }
    if (!CLAIMABLE_STATUSES.has(tokenTag.status)) {
      return NextResponse.json(
        { error: "Tag is already claimed or unavailable." },
        { status: 409 }
      );
    }
    const { error: updateError } = await supabaseAdmin
      .from("hardware_tags")
      .update({ status: "claimed", last_claimed_at: now })
      .eq("id", tokenTag.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    tagId = tokenTag.id;
  }

  let profileId = payload?.profileId ?? null;
  if (!profileId) {
    try {
      const activeProfile = await getActiveProfileForUser(auth.user.id);
      profileId = activeProfile?.id ?? null;
    } catch {
      profileId = null;
    }
  }

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("tag_assignments")
    .upsert(
      {
        tag_id: tagId,
        user_id: auth.user.id,
        profile_id: profileId,
        nickname: payload?.nickname ?? null,
      },
      { onConflict: "tag_id" }
    )
    .select("id")
    .single();
  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  }

  await supabaseAdmin.from("tag_events").insert({
    tag_id: tagId,
    event_type: "claim",
    metadata: {
      user_id: auth.user.id,
      claimer_user_id: auth.user.id,
      entitlement_user_id: auth.user.id,
      entitlement_source: "linket_claim",
      giftable: true,
    },
  });

  if (getStripeSecretKey()) {
    try {
      const complimentaryWindow = await getLinketBundleComplimentaryWindowForUser(
        auth.user.id
      );
      if (complimentaryWindow.eligible) {
        const customerId = await getOrCreateStripeCustomerForUser({
          userId: auth.user.id,
          email: auth.user.email ?? null,
          fullName:
            (auth.user.user_metadata?.full_name as string | null | undefined) ??
            (auth.user.user_metadata?.name as string | null | undefined) ??
            null,
          firstName:
            (auth.user.user_metadata?.first_name as string | null | undefined) ??
            null,
          lastName:
            (auth.user.user_metadata?.last_name as string | null | undefined) ??
            null,
        });

        if (customerId) {
          const stripe = getStripeServerClient();
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: "all",
            limit: 20,
          });
          const subscriptionId = pickManageableSubscriptionId(subscriptions.data);
          if (subscriptionId) {
            await ensureNoChargeDuringComplimentary({
              stripe,
              subscriptionId,
              complimentaryStartsAt: complimentaryWindow.startsAt,
              complimentaryEndsAt: complimentaryWindow.endsAt,
              source: "linket_claim_api",
            });
          }
        }
      }
    } catch (error) {
      console.error(
        "Linket claim completed but failed to enforce complimentary no-charge pause:",
        error
      );
    }
  }

  return NextResponse.json({ ok: true, assignmentId: assignment?.id ?? null });
}
