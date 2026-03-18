import { NextResponse } from "next/server";

import { requireRouteAccess } from "@/lib/api-authorization";

export async function GET() {
  const access = await requireRouteAccess("GET /api/me");
  if (access instanceof NextResponse) {
    return access;
  }

  return NextResponse.json({
    user: {
      id: access.user.id,
      email: access.user.email ?? null,
      name:
        (access.user.user_metadata?.full_name as string | null | undefined) ??
        (access.user.user_metadata?.name as string | null | undefined) ??
        null,
    },
  });
}
