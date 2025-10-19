import { NextResponse } from "next/server";
import {
  getProfilesForUser,
  saveProfileForUser,
  type ProfilePayload,
} from "@/lib/profile-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  try {
    const profiles = await getProfilesForUser(userId);
    return NextResponse.json(profiles);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load profiles";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, profile } = (await request.json()) as {
      userId?: string;
      profile?: ProfilePayload;
    };
    if (!userId || !profile) {
      return NextResponse.json({ error: "userId and profile are required" }, { status: 400 });
    }
    const saved = await saveProfileForUser(userId, profile);
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
