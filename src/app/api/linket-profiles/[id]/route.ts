import { NextResponse } from "next/server";
import { deleteProfileForUser, getProfilesForUser } from "@/lib/profile-service";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const url = new URL(_request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    const existing = await getProfilesForUser(userId);
    if (!existing.some((profile) => profile.id === params.id)) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    await deleteProfileForUser(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
