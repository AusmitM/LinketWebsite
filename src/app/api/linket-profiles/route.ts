import { NextRequest, NextResponse } from "next/server";
import {
  getProfilesForUser,
  saveProfileForUser,
  type ProfilePayload,
} from "@/lib/profile-service";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ProfileLinkRecord, UserProfileRecord } from "@/types/db";

type ProfileWithLinks = UserProfileRecord & { links: ProfileLinkRecord[] };

function normalizeHandle(handle: string) {
  return handle.trim().toLowerCase();
}

function sortLinks(links: ProfileLinkRecord[] | null | undefined) {
  return (links ?? [])
    .slice()
    .sort(
      (a, b) =>
        (a.order_index ?? 0) - (b.order_index ?? 0) ||
        a.created_at.localeCompare(b.created_at)
    );
}

function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function ensureAuthedUser(userId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { supabase, ok: false, error: "Unauthorized" };
  }
  if (data.user.id !== userId) {
    return { supabase, ok: false, error: "Forbidden" };
  }
  return { supabase, ok: true };
}

async function ensureHasActiveProfile(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  fallbackId: string
) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  if (data?.id) return;
  await supabase
    .from("user_profiles")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", fallbackId)
    .eq("user_id", userId);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    if (isSupabaseAdminAvailable) {
      try {
        const profiles = await getProfilesForUser(userId);
        return NextResponse.json(profiles, {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        });
      } catch (adminError) {
        console.error("Linket profiles admin fetch error:", adminError);
      }
    }

    const { supabase, ok, error } = await ensureAuthedUser(userId);
    if (!ok) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { data, error: fetchError } = await supabase
      .from("user_profiles")
      .select("*, links:profile_links(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (fetchError) throw new Error(fetchError.message);

    const profiles = (data as ProfileWithLinks[] | null | undefined) ?? [];
    const mapped = profiles.map((profile) => ({
      ...profile,
      links: sortLinks(profile.links),
    }));

    return NextResponse.json(mapped, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Linket profiles API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch profiles",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, profile } = body as {
      userId?: string;
      profile?: ProfilePayload;
    };

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "profile payload is required" },
        { status: 400 }
      );
    }

    if (isSupabaseAdminAvailable) {
      try {
        const saved = await saveProfileForUser(userId, profile);
        return NextResponse.json(saved, {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        });
      } catch (adminError) {
        console.error("Linket profiles admin save error:", adminError);
      }
    }

    const { supabase, ok, error } = await ensureAuthedUser(userId);
    if (!ok) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const name = profile.name?.trim();
    const handle = normalizeHandle(profile.handle ?? "");
    if (!name) {
      return NextResponse.json(
        { error: "Profile name is required" },
        { status: 400 }
      );
    }
    if (!handle) {
      return NextResponse.json(
        { error: "Handle is required" },
        { status: 400 }
      );
    }

    let profileId = profile.id ?? null;
    if (!profileId) {
      const { data, error: insertError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: userId,
          name,
          handle,
          headline: profile.headline?.trim() || null,
          theme: profile.theme,
          is_active: false,
        })
        .select("*")
        .single();
      if (insertError) throw new Error(insertError.message);
      profileId = (data as UserProfileRecord).id;
    } else {
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          name,
          handle,
          headline: profile.headline?.trim() || null,
          theme: profile.theme,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)
        .eq("user_id", userId);
      if (updateError) throw new Error(updateError.message);
    }

    const { data: existingLinks, error: existingError } = await supabase
      .from("profile_links")
      .select("id")
      .eq("profile_id", profileId);
    if (existingError) throw new Error(existingError.message);

    const indexedLinks = (profile.links ?? []).map((link, index) => ({
      ...link,
      order_index: index,
    }));
    const incomingIds = new Set(
      indexedLinks.filter((link) => isUuid(link.id)).map((link) => link.id!)
    );
    const idsToDelete = (existingLinks ?? [])
      .map((row) => row.id as string)
      .filter((id) => !incomingIds.has(id));

    if (idsToDelete.length) {
      const { error: deleteError } = await supabase
        .from("profile_links")
        .delete()
        .in("id", idsToDelete);
      if (deleteError) throw new Error(deleteError.message);
    }

    const upsertLinks = indexedLinks
      .filter((link) => isUuid(link.id))
      .map((link) => ({
        id: link.id!,
        profile_id: profileId,
        user_id: userId,
        title: link.title?.trim() || "Link",
        url: link.url?.trim() || "https://",
        order_index: link.order_index,
        is_active: true,
      }));
    if (upsertLinks.length) {
      const { error: upsertLinksError } = await supabase
        .from("profile_links")
        .upsert(upsertLinks, { onConflict: "id" });
      if (upsertLinksError) throw new Error(upsertLinksError.message);
    }

    const newLinks = indexedLinks.filter((link) => !isUuid(link.id));
    if (newLinks.length) {
      const formatted = newLinks.map((link) => ({
        profile_id: profileId,
        user_id: userId,
        title: link.title?.trim() || "Link",
        url: link.url?.trim() || "https://",
        order_index: link.order_index,
        is_active: true,
      }));
      const { error: insertLinksError } = await supabase
        .from("profile_links")
        .insert(formatted);
      if (insertLinksError) throw new Error(insertLinksError.message);
    }

    if (profile.active) {
      const { error: deactivateError } = await supabase
        .from("user_profiles")
        .update({ is_active: false })
        .eq("user_id", userId);
      if (deactivateError) throw new Error(deactivateError.message);
      const { error: activateError } = await supabase
        .from("user_profiles")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", profileId)
        .eq("user_id", userId);
      if (activateError) throw new Error(activateError.message);
    } else {
      await ensureHasActiveProfile(supabase, userId, profileId);
    }

    const { data: saved, error: fetchError } = await supabase
      .from("user_profiles")
      .select("*, links:profile_links(*)")
      .eq("id", profileId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!saved) throw new Error("Profile not found after save");

    const payload = {
      ...(saved as ProfileWithLinks),
      links: sortLinks((saved as ProfileWithLinks).links),
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Linket profiles API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save profile",
      },
      { status: 500 }
    );
  }
}

