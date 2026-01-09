import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { getAssignmentsForUser } from "@/lib/linket-tags";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
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

  const requestedUserId = req.nextUrl.searchParams.get("userId");
  if (requestedUserId && requestedUserId !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const assignments = await getAssignmentsForUser(auth.user.id);
    return NextResponse.json(assignments);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load Linkets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
