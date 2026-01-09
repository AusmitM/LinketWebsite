import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { updateAssignmentForUser } from "@/lib/linket-tags";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";

type PatchPayload = {
  userId?: string;
  profileId?: string | null;
  nickname?: string | null;
  action?: "release" | "retire";
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json(
      { error: "Linkets service is not configured." },
      { status: 500 }
    );
  }

  const supabase = await createServerSupabaseReadonly();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: assignmentId } = await params;
  if (!assignmentId) {
    return NextResponse.json({ error: "Missing assignment id." }, { status: 400 });
  }

  const payload = (await req.json().catch(() => null)) as PatchPayload | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const hasProfileId = Object.prototype.hasOwnProperty.call(payload, "profileId");
  const hasNickname = Object.prototype.hasOwnProperty.call(payload, "nickname");

  try {
    const updated = await updateAssignmentForUser({
      assignmentId,
      userId: auth.user.id,
      action: payload.action,
      profileId: hasProfileId ? payload.profileId ?? null : undefined,
      nickname: hasNickname ? payload.nickname ?? null : undefined,
    });
    return NextResponse.json({ assignment: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update Linket";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
