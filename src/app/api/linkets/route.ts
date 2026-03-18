import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRouteAccess } from "@/lib/api-authorization";
import { getAssignmentsForUser } from "@/lib/linket-tags";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";

const linketsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json(
      { error: "Linkets service is not configured." },
      { status: 500 }
    );
  }

  const access = await requireRouteAccess("GET /api/linkets");
  if (access instanceof NextResponse) {
    return access;
  }

  const parsedQuery = linketsQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid userId." }, { status: 400 });
  }

  const requestedUserId = parsedQuery.data.userId;
  if (requestedUserId && requestedUserId !== access.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const assignments = await getAssignmentsForUser(access.user.id);
    return NextResponse.json(assignments);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load Linkets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
