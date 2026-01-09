import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

export type CurrentUserAdmin = {
  user: Awaited<ReturnType<typeof getUserOnly>>["user"];
  isAdmin: boolean;
};

async function getUserOnly() {
  const supabase = await createServerSupabase();
  const result = await supabase.auth.getUser();
  return {
    supabase,
    user: result.data.user,
  };
}

export async function getCurrentUserWithAdmin(): Promise<CurrentUserAdmin> {
  const { supabase, user } = await getUserOnly();
  if (!user) return { user: null, isAdmin: false };

  if (isSupabaseAdminAvailable) {
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .limit(1);
    return { user, isAdmin: !error && Array.isArray(data) && data.length > 0 };
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .limit(1);

  return { user, isAdmin: !error && Array.isArray(data) && data.length > 0 };
}

export async function requireAdminOrThrow(): Promise<NonNullable<CurrentUserAdmin["user"]>> {
  const { user, isAdmin } = await getCurrentUserWithAdmin();
  if (!user) {
    throw new Error("Not authenticated");
  }
  if (!isAdmin) {
    throw new Error("Admin privileges required");
  }
  return user;
}
