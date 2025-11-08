import { NextResponse } from "next/server";
import { getAssignmentsForUser } from "@/lib/linket-tags";
import { getProfilesForUser } from "@/lib/profile-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  console.log("API GET /api/linket-profiles - userId:", userId); // ADD THIS
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  try {
    const profiles = await getProfilesForUser(userId);
    console.log(
      "API GET /api/linket-profiles - profiles found:",
      profiles.length
    ); // ADD THIS
    return NextResponse.json(profiles);
  } catch (error) {
    console.error("API GET /api/linket-profiles - error:", error); // ADD THIS
    const message =
      error instanceof Error ? error.message : "Unable to load profiles";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
