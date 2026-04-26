import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRouteAccess } from "@/lib/api-authorization";
import { getLinketTransferPreview } from "@/lib/linket-transfers";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";

const tokenParamSchema = z.string().trim().min(24).max(128);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json(
      { error: "Linkets service is not configured." },
      { status: 500 }
    );
  }

  const access = await requireRouteAccess("GET /api/linkets/transfers/[token]", {
    includeAdminLookup: true,
  });
  if (access instanceof NextResponse) {
    return access;
  }

  const { token } = await params;
  const parsedToken = tokenParamSchema.safeParse(token);
  if (!parsedToken.success) {
    return NextResponse.json({ error: "Invalid transfer token." }, { status: 400 });
  }

  try {
    const preview = await getLinketTransferPreview({
      token: parsedToken.data,
      currentUser: access.user,
      isAdmin: access.isAdmin,
    });

    if (!preview) {
      return NextResponse.json(
        { error: "Transfer invite not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(preview);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load transfer invite.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
