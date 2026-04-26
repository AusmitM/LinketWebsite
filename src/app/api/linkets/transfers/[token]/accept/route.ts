import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRouteAccess } from "@/lib/api-authorization";
import { acceptLinketTransferRequest } from "@/lib/linket-transfers";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";

const tokenParamSchema = z.string().trim().min(24).max(128);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json(
      { error: "Linkets service is not configured." },
      { status: 500 }
    );
  }

  const access = await requireRouteAccess(
    "POST /api/linkets/transfers/[token]/accept"
  );
  if (access instanceof NextResponse) {
    return access;
  }

  const { token } = await params;
  const parsedToken = tokenParamSchema.safeParse(token);
  if (!parsedToken.success) {
    return NextResponse.json({ error: "Invalid transfer token." }, { status: 400 });
  }

  try {
    const result = await acceptLinketTransferRequest({
      token: parsedToken.data,
      currentUser: access.user,
    });

    return NextResponse.json({
      ok: true,
      assignmentId: result.assignmentId,
      tagId: result.tagId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to accept Linket transfer.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
