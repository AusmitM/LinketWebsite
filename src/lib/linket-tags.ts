import { supabaseAdmin } from "@/lib/supabase-admin";
import { getActiveProfileForUser } from "@/lib/profile-service";
import type {
  HardwareTagRecord,
  TagAssignmentRecord,
  TagEventRecord,
  UserProfileRecord,
} from "@/types/db";

export type TagAssignmentDetail = {
  assignment: TagAssignmentRecord;
  tag: HardwareTagRecord;
  profile: Pick<UserProfileRecord, "id" | "name" | "handle" | "is_active"> | null;
};

function normaliseChipUid(uid: string) {
  return uid.trim();
}

function mapAssignmentRow(row: Record<string, unknown>): TagAssignmentDetail {
  const assignment = {
    id: row.id as string,
    tag_id: row.tag_id as string,
    user_id: row.user_id as string,
    profile_id: (row.profile_id as string | null) ?? null,
    nickname: (row.nickname as string | null) ?? null,
    last_redirected_at: (row.last_redirected_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  } satisfies TagAssignmentRecord;

  const tagRecord = row.hardware_tags ?? row.tag ?? row.tags;
  if (!tagRecord || typeof tagRecord !== "object" || tagRecord === null) {
    throw new Error("Malformed assignment row: missing hardware tag relation");
  }
  const tagObj = tagRecord as Record<string, unknown>;
  const tag: HardwareTagRecord = {
    id: tagObj.id as string,
    chip_uid: tagObj.chip_uid as string,
    claim_code: (tagObj.claim_code as string | null) ?? null,
    status: tagObj.status as "unclaimed" | "claimed" | "retired",
    last_claimed_at: (tagObj.last_claimed_at as string | null) ?? null,
    created_at: tagObj.created_at as string,
    updated_at: tagObj.updated_at as string,
  };

  const profileRecord = row.profile ?? row.user_profiles ?? null;
    let profile: Pick<UserProfileRecord, "id" | "name" | "handle" | "is_active"> | null = null;
    if (profileRecord && typeof profileRecord === "object" && profileRecord !== null) {
      const p = profileRecord as Record<string, unknown>;
      profile = {
        id: p.id as string,
        name: p.name as string,
        handle: p.handle as string,
        is_active: Boolean(p.is_active),
      };
    }

  return { assignment, tag, profile };
}

async function fetchAssignmentById(assignmentId: string): Promise<TagAssignmentDetail | null> {
  const { data, error } = await supabaseAdmin
    .from("tag_assignments")
    .select(
      `*,
      hardware_tags:hardware_tags(
        id, chip_uid, claim_code, status, last_claimed_at, created_at, updated_at
      ),
      profile:user_profiles(id, name, handle, is_active)
    `
    )
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapAssignmentRow(data);
}

export async function getAssignmentsForUser(userId: string): Promise<TagAssignmentDetail[]> {
  const { data, error } = await supabaseAdmin
    .from("tag_assignments")
    .select(
      `*,
      hardware_tags:hardware_tags(
        id, chip_uid, claim_code, status, last_claimed_at, created_at, updated_at
      ),
      profile:user_profiles(id, name, handle, is_active)
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAssignmentRow);
}

export async function claimTagForUser(options: {
  userId: string;
  chipUid: string;
  nickname?: string | null;
  profileId?: string | null;
}): Promise<TagAssignmentDetail> {
  const chipUid = normaliseChipUid(options.chipUid);
  if (!chipUid) throw new Error("chipUid is required");
  const now = new Date().toISOString();

  const { data: tag, error: tagError } = await supabaseAdmin
    .from("hardware_tags")
    .select("id, status")
    .eq("chip_uid", chipUid)
    .maybeSingle();
  if (tagError) throw new Error(tagError.message);

  let tagId: string;
  if (!tag) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("hardware_tags")
      .insert({ chip_uid: chipUid, claim_code: chipUid, status: "claimed", last_claimed_at: now })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    tagId = inserted.id as string;
  } else {
    if (tag.status !== "unclaimed") {
      throw new Error("Tag is already claimed or unavailable");
    }
    const { error: updateError } = await supabaseAdmin
      .from("hardware_tags")
      .update({ status: "claimed", last_claimed_at: now })
      .eq("id", tag.id);
    if (updateError) throw new Error(updateError.message);
    tagId = tag.id as string;
  }

  let profileId = options.profileId ?? null;
  if (!profileId) {
    try {
      const activeProfile = await getActiveProfileForUser(options.userId);
      profileId = activeProfile?.id ?? null;
    } catch (error) {
      console.warn("claimTagForUser:getActiveProfileForUser", error);
    }
  }

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("tag_assignments")
    .insert({
      tag_id: tagId,
      user_id: options.userId,
      profile_id: profileId,
      nickname: options.nickname ?? null,
    })
    .select("id")
    .single();
  if (assignmentError) throw new Error(assignmentError.message);

  await supabaseAdmin.from("tag_events").insert({
    tag_id: tagId,
    event_type: "claim",
    metadata: { user_id: options.userId },
  } satisfies Partial<TagEventRecord>);

  const detail = await fetchAssignmentById(assignment.id as string);
  if (!detail) throw new Error("Assignment not found after creation");
  return detail;
}

export async function updateAssignmentForUser(options: {
  assignmentId: string;
  userId: string;
  profileId?: string | null;
  nickname?: string | null;
  action?: "release" | "retire";
}): Promise<TagAssignmentDetail | null> {
  const current = await fetchAssignmentById(options.assignmentId);
  if (!current) throw new Error("Assignment not found");
  if (current.assignment.user_id !== options.userId) {
    throw new Error("Not authorized to modify this Linket");
  }

  if (options.action === "release") {
    const { error: deleteError } = await supabaseAdmin
      .from("tag_assignments")
      .delete()
      .eq("id", options.assignmentId);
    if (deleteError) throw new Error(deleteError.message);

    const { error: tagUpdateError } = await supabaseAdmin
      .from("hardware_tags")
      .update({ status: "unclaimed" })
      .eq("id", current.assignment.tag_id);
    if (tagUpdateError) throw new Error(tagUpdateError.message);

    await supabaseAdmin.from("tag_events").insert({
      tag_id: current.assignment.tag_id,
      event_type: "release",
      metadata: { user_id: options.userId },
    } satisfies Partial<TagEventRecord>);

    return null;
  }

  const payload: Record<string, unknown> = {};
  if (options.nickname !== undefined) {
    payload.nickname = options.nickname;
  }
  if (options.profileId !== undefined) {
    payload.profile_id = options.profileId;
  }

  if (Object.keys(payload).length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from("tag_assignments")
      .update(payload)
      .eq("id", options.assignmentId);
    if (updateError) throw new Error(updateError.message);
  }

  return fetchAssignmentById(options.assignmentId);
}

export async function recordTagEvent(event: Partial<TagEventRecord>) {
  await supabaseAdmin.from("tag_events").insert(event);
}

