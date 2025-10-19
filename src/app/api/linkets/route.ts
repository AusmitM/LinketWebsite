import { NextResponse } from "next/server";
import { getAssignmentsForUser } from "@/lib/linket-tags";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const assignments = await getAssignmentsForUser(userId);
    return NextResponse.json(assignments);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Linkets";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
