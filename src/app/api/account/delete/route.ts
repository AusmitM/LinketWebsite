import { NextResponse } from "next/server";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase-admin";

async function removeStorageFolder(bucket: string, prefix: string) {
  const { data, error } = await supabaseAdmin
    .storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error || !data?.length) return;
  const paths = data.map((item) => `${prefix}/${item.name}`);
  await supabaseAdmin.storage.from(bucket).remove(paths);
}

export async function POST() {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json(
      { error: "Account deletion is not configured." },
      { status: 500 }
    );
  }

  const supabase = await createServerSupabaseReadonly();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = auth.user.id;

  try {
    const tableDeletes: Array<Promise<{ error: { message?: string } | null }>> = [
      supabaseAdmin.from("lead_form_settings").delete().eq("user_id", userId),
      supabaseAdmin.from("lead_form_fields").delete().eq("user_id", userId),
      supabaseAdmin.from("lead_forms").delete().eq("user_id", userId),
      supabaseAdmin.from("profile_links").delete().eq("user_id", userId),
      supabaseAdmin.from("user_profiles").delete().eq("user_id", userId),
      supabaseAdmin.from("vcard_profiles").delete().eq("user_id", userId),
      supabaseAdmin.from("profiles").delete().eq("user_id", userId),
      supabaseAdmin.from("admin_users").delete().eq("user_id", userId),
    ];
    const results = await Promise.all(tableDeletes);
    const deleteError = results.find((result) => result.error)?.error;
    if (deleteError) throw new Error(deleteError.message ?? "Failed to delete account data");

    await supabaseAdmin.storage.from("avatars").remove([
      `${userId}/avatar.webp`,
      `${userId}/avatar_128.webp`,
    ]);
    await removeStorageFolder("profile-headers", `${userId}/profile-headers`);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userId
    );
    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
