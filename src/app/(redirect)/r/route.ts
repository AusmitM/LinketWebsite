
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getActiveProfileForPublicHandle } from "@/lib/profile-service";
import { recordTagEvent } from "@/lib/linket-tags";

type AssignmentProfile = { handle?: string | null } | null;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const chipUid = request.nextUrl.searchParams.get("id")?.trim();
  if (!chipUid) {
    return NextResponse.redirect(new URL("/missing-tag", request.url));
  }

  const { data: tagRow, error } = await supabaseAdmin
    .from("hardware_tags")
    .select(
      `id, status,
       tag_assignments:tag_assignments(
         id,
         user_id,
         profile_id,
         profile:user_profiles(handle)
       )`
    )
    .eq("chip_uid", chipUid)
    .maybeSingle();

  if (error) {
    console.error("redirect:hardware_tags", error);
    return NextResponse.redirect(new URL("/error", request.url));
  }

  if (!tagRow) {
    return NextResponse.redirect(new URL(`/unrecognized?tag=${encodeURIComponent(chipUid)}`, request.url));
  }

  const assignment = Array.isArray(tagRow.tag_assignments)
    ? tagRow.tag_assignments[0] ?? null
    : tagRow.tag_assignments ?? null;

  if (!assignment) {
    return NextResponse.redirect(new URL(`/claim?tag=${encodeURIComponent(chipUid)}`, request.url));
  }

  // Handle both array and object cases for assignment.profile, without using 'any'
  let profileHandle: string | null = null;
  const getProfileHandle = (profile: unknown): string | null => {
    if (!profile) return null;
    if (Array.isArray(profile)) {
      const first = profile[0] as AssignmentProfile;
      return first?.handle ?? null;
    }
    if (typeof profile === "object" && profile !== null && "handle" in profile) {
      const p = profile as AssignmentProfile;
      return p && p.handle ? p.handle : null;
    }
    return null;
  };
  profileHandle = getProfileHandle(assignment.profile);
  const fallbackHandle = profileHandle || null;
  let destination = fallbackHandle
    ? new URL(`/u/${fallbackHandle}`, request.url)
    : new URL(`/claim?tag=${encodeURIComponent(chipUid)}`, request.url);

  try {
    if (fallbackHandle) {
      const target = await getActiveProfileForPublicHandle(fallbackHandle);
      if (target?.account?.username) {
        destination = new URL(`/u/${target.account.username}`, request.url);
      }
    }
  } catch (profileError) {
    console.warn("redirect:profile", profileError);
  }

  try {
    await recordTagEvent({
      tag_id: tagRow.id as string,
      event_type: "scan",
      metadata: { user_id: assignment.user_id },
    });
  } catch (eventError) {
    console.warn("redirect:event", eventError);
  }

  return NextResponse.redirect(destination);
}