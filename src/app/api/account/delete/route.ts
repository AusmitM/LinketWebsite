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

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

async function deleteByUserColumn(table: string, userColumn: string, userId: string) {
  const { error } = await supabaseAdmin.from(table).delete().eq(userColumn, userId);
  if (error && !isMissingRelationError(error)) {
    throw new Error(`[${table}] ${error.message}`);
  }
}

async function deleteUserAuthoredNotifications(userId: string) {
  const { error } = await supabaseAdmin
    .from("dashboard_notifications")
    .delete()
    .or(`created_by.eq.${userId},updated_by.eq.${userId}`);
  if (error && !isMissingRelationError(error)) {
    throw new Error(`[dashboard_notifications] ${error.message}`);
  }
}

async function releaseUserTagAssignments(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("tag_assignments")
    .select("id, tag_id")
    .eq("user_id", userId);
  if (error) {
    if (isMissingRelationError(error)) return;
    throw new Error(`[tag_assignments] ${error.message}`);
  }

  const assignments =
    (data as Array<{ id: string; tag_id: string | null }> | null) ?? [];
  if (assignments.length === 0) return;

  const tagIds = Array.from(
    new Set(
      assignments
        .map((assignment) => assignment.tag_id)
        .filter((tagId): tagId is string => Boolean(tagId))
    )
  );

  const { error: deleteAssignmentsError } = await supabaseAdmin
    .from("tag_assignments")
    .delete()
    .eq("user_id", userId);
  if (deleteAssignmentsError && !isMissingRelationError(deleteAssignmentsError)) {
    throw new Error(`[tag_assignments] ${deleteAssignmentsError.message}`);
  }

  if (tagIds.length > 0) {
    const { error: resetTagsError } = await supabaseAdmin
      .from("hardware_tags")
      .update({
        status: "unclaimed",
        last_claimed_at: null,
      })
      .in("id", tagIds);
    if (resetTagsError && !isMissingRelationError(resetTagsError)) {
      throw new Error(`[hardware_tags] ${resetTagsError.message}`);
    }
  }
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
    await releaseUserTagAssignments(userId);

    await deleteByUserColumn("conversion_events", "user_id", userId);
    await deleteByUserColumn("lead_form_settings", "user_id", userId);
    await deleteByUserColumn("lead_form_fields", "user_id", userId);
    await deleteByUserColumn("lead_forms", "user_id", userId);
    await deleteByUserColumn("profile_links", "user_id", userId);
    await deleteByUserColumn("user_profiles", "user_id", userId);
    await deleteByUserColumn("vcard_profiles", "user_id", userId);
    await deleteByUserColumn("profiles", "user_id", userId);
    await deleteByUserColumn("admin_users", "user_id", userId);
    await deleteUserAuthoredNotifications(userId);

    await supabaseAdmin.storage.from("avatars").remove([
      `${userId}/avatar.webp`,
      `${userId}/avatar_128.webp`,
    ]);
    await removeStorageFolder("profile-headers", `${userId}/profile-headers`);
    await removeStorageFolder("profile-logos", `${userId}/profile-logos`);
    await removeStorageFolder("lead-form-uploads", userId);

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userId
    );
    if (authDeleteError) throw new Error(authDeleteError.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
