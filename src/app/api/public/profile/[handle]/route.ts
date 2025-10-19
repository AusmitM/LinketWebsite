import { NextResponse } from "next/server";
import { getActiveProfileForPublicHandle } from "@/lib/profile-service";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> }
) {
  try {
    const params = await context.params;
    const result = await getActiveProfileForPublicHandle(params.handle);
    if (!result) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const { account, profile } = result;
    return NextResponse.json({ account, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
