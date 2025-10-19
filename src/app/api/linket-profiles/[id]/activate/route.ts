import { NextResponse } from "next/server";
import { setActiveProfileForUser } from "@/lib/profile-service";

export const dynamic = "force-dynamic";

export async function POST(
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
    const profile = await setActiveProfileForUser(userId, params.id);
    return NextResponse.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to activate profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
