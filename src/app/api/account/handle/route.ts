import { NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAccountHandleForUser } from "@/lib/profile-service";

function normalizeHandle(handle: string) {
  return handle.trim().toLowerCase();
}

async function fetchActiveProfileHandle(
  supabase: typeof supabaseAdmin,
  userId: string
) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("handle")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }
  const handle = data?.handle;
  return handle ? normalizeHandle(handle as string) : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabase();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (auth.user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isSupabaseAdminAvailable) {
      try {
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, updated_at")
          .eq("user_id", userId)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          throw new Error(error.message);
        }

        const handle =
          (await fetchActiveProfileHandle(supabaseAdmin, userId)) ??
          (await getAccountHandleForUser(userId));

        return NextResponse.json({
          handle,
          avatarPath: data?.avatar_url ?? null,
          avatarUpdatedAt: data?.updated_at ?? null,
          displayName: data?.display_name ?? null,
        });
      } catch (adminError) {
        console.error("Account handle admin lookup error:", adminError);
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }
    const handle =
      (await fetchActiveProfileHandle(supabase as typeof supabaseAdmin, userId)) ??
      (await getAccountHandleForUser(userId));
    return NextResponse.json({
      handle,
      avatarPath: data?.avatar_url ?? null,
      avatarUpdatedAt: data?.updated_at ?? null,
      displayName: data?.display_name ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
