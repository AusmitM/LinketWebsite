import { createServerSupabase } from "@/lib/supabase/server";

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

  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return { user, isAdmin: Boolean(data) };
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
