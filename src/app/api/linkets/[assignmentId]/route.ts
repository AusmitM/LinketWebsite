import { NextResponse } from "next/server";
import { updateAssignmentForUser } from "@/lib/linket-tags";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const params = await context.params;
    const body = (await request.json()) as {
      userId?: string;
      profileId?: string | null;
      nickname?: string | null;
      action?: "release" | "retire";
    };
    const assignmentId = params.assignmentId;
    if (!assignmentId || !body.userId) {
      return NextResponse.json({ error: "assignmentId and userId are required" }, { status: 400 });
    }

    const detail = await updateAssignmentForUser({
      assignmentId,
      userId: body.userId,
      profileId: body.profileId,
      nickname: body.nickname ?? undefined,
      action: body.action,
    });

    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update Linket";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json().catch(() => ({})) as { userId?: string };
    const assignmentId = params.assignmentId;
    const userId = body.userId;
    if (!assignmentId || !userId) {
      return NextResponse.json({ error: "assignmentId and userId are required" }, { status: 400 });
    }
    await updateAssignmentForUser({
      assignmentId,
      userId,
      action: "release",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete Linket";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}