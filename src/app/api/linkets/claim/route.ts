import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireRouteAccess } from "@/lib/api-authorization";
import {
  ensureNoChargeDuringComplimentary,
  pickManageableSubscriptionId,
} from "@/lib/billing/complimentary-subscription";
import { getOrCreateStripeCustomerForUser } from "@/lib/billing/dashboard";
import { getLinketBundleComplimentaryWindowForUser } from "@/lib/billing/linket-bundle";
import { assertOwnedProfileId } from "@/lib/linket-tags";
import { validateJsonBody } from "@/lib/request-validation";
import { getStripeSecretKey, getStripeServerClient } from "@/lib/stripe";
import { getActiveProfileForUser } from "@/lib/profile-service";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

type ClaimPayload = {
  chipUid?: string;
  claimCode?: string;
  profileId?: string | null;
  nickname?: string | null;
};

const claimPayloadSchema = z
  .object({
    chipUid: z.string().trim().max(128).optional(),
    claimCode: z.string().trim().max(128).optional(),
    nickname: z.string().trim().max(120).nullable().optional(),
    profileId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Boolean(value.chipUid || value.claimCode), {
    message: "Claim code is required.",
    path: ["claimCode"],
  });

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

async function findClaimTag(candidates: { lower: string; upper: string }) {
  const lookupValues = Array.from(
    new Set([candidates.upper, candidates.lower].filter(Boolean))
  );
  const { data, error } = await supabaseAdmin
    .from("hardware_tags")
    .select("id,status")
    .in("claim_code", lookupValues)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function findTokenTag(candidates: { lower: string; upper: string }) {
  const lookupValues = Array.from(
    new Set([candidates.upper, candidates.lower].filter(Boolean))
  );
  const chipUidLookup = await supabaseAdmin
    .from("hardware_tags")
    .select("id,status")
    .in("chip_uid", lookupValues)
    .limit(1)
    .maybeSingle();
  if (chipUidLookup.error) {
    throw new Error(chipUidLookup.error.message);
  }
  if (chipUidLookup.data) {
    return chipUidLookup.data;
  }

  const publicTokenLookup = await supabaseAdmin
    .from("hardware_tags")
    .select("id,status")
    .in("public_token", lookupValues)
    .limit(1)
    .maybeSingle();
  if (publicTokenLookup.error) {
    throw new Error(publicTokenLookup.error.message);
  }
  return publicTokenLookup.data;
}

export async function POST(req: NextRequest) {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json(
      { error: "Linkets service is not configured." },
      { status: 500 }
    );
  }

  const access = await requireRouteAccess("POST /api/linkets/claim");
  if (access instanceof NextResponse) {
    return access;
  }

  const parsedBody = await validateJsonBody(req, claimPayloadSchema);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const payload = parsedBody.data as ClaimPayload;
  const rawCode = payload.chipUid ?? payload.claimCode ?? "";
  const candidates = buildClaimLookupCandidates(rawCode || "");

  let profileId = payload.profileId ?? null;
  if (!profileId) {
    try {
      const activeProfile = await getActiveProfileForUser(access.user.id);
      profileId = activeProfile?.id ?? null;
    } catch {
      profileId = null;
    }
  }
  try {
    profileId = await assertOwnedProfileId(access.user.id, profileId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Forbidden" },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();
  let tagId: string | null = null;

  try {
    const claimTag = await findClaimTag(candidates);
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
      const tokenTag = await findTokenTag(candidates);
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to claim Linket." },
      { status: 500 }
    );
  }

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("tag_assignments")
    .upsert(
      {
        tag_id: tagId,
        user_id: access.user.id,
        profile_id: profileId,
        nickname: payload.nickname ?? null,
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
      user_id: access.user.id,
      claimer_user_id: access.user.id,
      entitlement_user_id: access.user.id,
      entitlement_source: "linket_claim",
      giftable: true,
    },
  });

  if (getStripeSecretKey()) {
    try {
      const complimentaryWindow = await getLinketBundleComplimentaryWindowForUser(
        access.user.id
      );
      if (complimentaryWindow.eligible) {
        const customerId = await getOrCreateStripeCustomerForUser({
          userId: access.user.id,
          email: access.user.email ?? null,
          fullName:
            (access.user.user_metadata?.full_name as string | null | undefined) ??
            (access.user.user_metadata?.name as string | null | undefined) ??
            null,
          firstName:
            (access.user.user_metadata?.first_name as string | null | undefined) ??
            null,
          lastName:
            (access.user.user_metadata?.last_name as string | null | undefined) ??
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
