import { NextRequest, NextResponse } from "next/server";
import { setActiveProfileForUser } from "@/lib/profile-service";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { recordConversionEvent } from "@/lib/server-conversion-events";
import type { ProfileLinkRecord, UserProfileRecord } from "@/types/db";

type ProfileWithLinks = UserProfileRecord & { links: ProfileLinkRecord[] };

function sortLinks(links: ProfileLinkRecord[] | null | undefined) {
  return (links ?? [])
    .slice()
    .sort(
      (a, b) =>
        (a.order_index ?? 0) - (b.order_index ?? 0) ||
        a.created_at.localeCompare(b.created_at)
    );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "profile id is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (data.user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isSupabaseAdminAvailable) {
      try {
        const profile = await setActiveProfileForUser(userId, id);
        await recordConversionEvent({
          eventId: "profile_published",
          userId,
          eventSource: "server",
          meta: { profileId: id, source: "activate-route" },
        });
        return NextResponse.json(profile, {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        });
      } catch (adminError) {
        console.error("Linket profiles admin activate error:", adminError);
      }
    }

    const { error: deactivateError } = await supabase
      .from("user_profiles")
      .update({ is_active: false })
      .eq("user_id", userId);
    if (deactivateError) throw new Error(deactivateError.message);

    const { error: activateError } = await supabase
      .from("user_profiles")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    if (activateError) throw new Error(activateError.message);

    const { data: profile, error: fetchError } = await supabase
      .from("user_profiles")
      .select("*, links:profile_links(*)")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!profile) throw new Error("Profile not found");

    const payload = profile as ProfileWithLinks;
    payload.links = sortLinks(payload.links);

    await recordConversionEvent({
      eventId: "profile_published",
      userId,
      eventSource: "server",
      meta: { profileId: id, source: "activate-route" },
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Linket profiles activate API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to activate profile",
      },
      { status: 500 }
    );
  }
}

