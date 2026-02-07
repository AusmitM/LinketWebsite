import { NextRequest, NextResponse } from "next/server";
import {
  getProfilesForUser,
  saveProfileForUser,
  isHandleConflictError,
  type ProfilePayload,
} from "@/lib/profile-service";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ProfileLinkRecord, UserProfileRecord } from "@/types/db";

type ProfileWithLinks = UserProfileRecord & { links: ProfileLinkRecord[] };
const DEFAULT_PROFILE_LINK_URL = "https://www.linketconect.com";

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

async function suggestHandles(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  handle: string
): Promise<string[]> {
  const { data } = await supabase
    .from("user_profiles")
    .select("handle")
    .like("handle", `${handle}%`)
    .limit(25);
  const taken = new Set(
    (data ?? [])
      .map((row) => (row as { handle?: string | null }).handle)
      .filter((value): value is string => Boolean(value))
  );
  taken.add(handle);
  const suggestions: string[] = [];
  for (let i = 1; i <= 50 && suggestions.length < 3; i += 1) {
    const candidate = `${handle}-${i}`;
    if (!taken.has(candidate)) {
      suggestions.push(candidate);
    }
  }
  return suggestions;
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

    const { supabase, ok, error } = await ensureAuthedUser(userId);
    if (!ok) {
      return NextResponse.json(
        { error },
        { status: error === "Forbidden" ? 403 : 401 }
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

    const { supabase, ok, error } = await ensureAuthedUser(userId);
    if (!ok) {
      return NextResponse.json(
        { error },
        { status: error === "Forbidden" ? 403 : 401 }
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
        if (isHandleConflictError(adminError)) {
          return NextResponse.json(
            { error: adminError.message, suggestions: adminError.suggestions },
            { status: 409 }
          );
        }
        console.error("Linket profiles admin save error:", adminError);
        return NextResponse.json(
          {
            error:
              adminError instanceof Error
                ? adminError.message
                : "Failed to save profile",
          },
          { status: 500 }
        );
      }
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

    if (profile.id) {
      const { data } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("handle", handle)
        .maybeSingle();
      if (data && (data as { id?: string }).id !== profile.id) {
        return NextResponse.json(
          {
            error: "Handle already taken",
            suggestions: await suggestHandles(supabase, handle),
          },
          { status: 409 }
        );
      }
    } else {
      const { data } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("handle", handle)
        .maybeSingle();
      if (data) {
        return NextResponse.json(
          {
            error: "Handle already taken",
            suggestions: await suggestHandles(supabase, handle),
          },
          { status: 409 }
        );
      }
    }

    let profileId = profile.id ?? null;
    const incomingLinks = profile.links ?? [];
    const linksForSave =
      !profileId && incomingLinks.length === 0
        ? [{ title: "Website", url: DEFAULT_PROFILE_LINK_URL }]
        : incomingLinks;
    if (!profileId) {
      const { data, error: insertError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: userId,
          name,
          handle,
          headline: profile.headline?.trim() || null,
          header_image_url: profile.headerImageUrl ?? null,
          header_image_updated_at: profile.headerImageUpdatedAt ?? null,
          logo_url: profile.logoUrl ?? null,
          logo_updated_at: profile.logoUpdatedAt ?? null,
          logo_shape: profile.logoShape ?? "circle",
          logo_bg_white: profile.logoBackgroundWhite ?? false,
          theme: profile.theme,
          is_active: false,
        })
        .select("*")
        .single();
      if (insertError) throw new Error(insertError.message);
      profileId = (data as UserProfileRecord).id;
    } else {
      const updatePayload: Record<string, unknown> = {
        name,
        handle,
        headline: profile.headline?.trim() || null,
        theme: profile.theme,
        updated_at: new Date().toISOString(),
      };
      if (profile.headerImageUrl !== undefined) {
        updatePayload.header_image_url = profile.headerImageUrl;
      }
      if (profile.headerImageUpdatedAt !== undefined) {
        updatePayload.header_image_updated_at = profile.headerImageUpdatedAt;
      }
      if (profile.logoUrl !== undefined) {
        updatePayload.logo_url = profile.logoUrl;
      }
      if (profile.logoUpdatedAt !== undefined) {
        updatePayload.logo_updated_at = profile.logoUpdatedAt;
      }
      if (profile.logoShape !== undefined) {
        updatePayload.logo_shape = profile.logoShape;
      }
      if (profile.logoBackgroundWhite !== undefined) {
        updatePayload.logo_bg_white = profile.logoBackgroundWhite;
      }
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update(updatePayload)
        .eq("id", profileId)
        .eq("user_id", userId);
      if (updateError) throw new Error(updateError.message);
    }

    const { data: existingLinks, error: existingError } = await supabase
      .from("profile_links")
      .select("id")
      .eq("profile_id", profileId);
    if (existingError) throw new Error(existingError.message);

    const indexedLinks = linksForSave.map((link, index) => ({
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

