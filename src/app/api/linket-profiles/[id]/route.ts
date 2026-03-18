import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRouteAccess } from "@/lib/api-authorization";
import { deleteProfileForUser } from "@/lib/profile-service";
import { validateSearchParams } from "@/lib/request-validation";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase/server";

const deleteProfileQuerySchema = z.object({
  userId: z.string().uuid(),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsedQuery = validateSearchParams(
      request.nextUrl.searchParams,
      deleteProfileQuerySchema
    );
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }
    const { userId } = parsedQuery.data;

    if (!id) {
      return NextResponse.json(
        { error: "profile id is required" },
        { status: 400 }
      );
    }

    const access = await requireRouteAccess("DELETE /api/linket-profiles/[id]", {
      resourceUserId: userId,
    });
    if (access instanceof NextResponse) {
      return access;
    }
    const supabase = await createServerSupabase();

    let adminSucceeded = false;
    if (isSupabaseAdminAvailable) {
      try {
        await deleteProfileForUser(userId, id);
        adminSucceeded = true;
      } catch (adminError) {
        console.error("Linket profiles admin delete error:", adminError);
      }
    }

    if (!adminSucceeded) {
      const { error: deleteError } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (deleteError) throw new Error(deleteError.message);

      const { data: active, error: activeError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (activeError && activeError.code !== "PGRST116") {
        throw new Error(activeError.message);
      }
      if (!active?.id) {
        const { data: first, error: firstError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (firstError && firstError.code !== "PGRST116") {
          throw new Error(firstError.message);
        }
        if (first?.id) {
          await supabase
            .from("user_profiles")
            .update({
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", first.id)
            .eq("user_id", userId);
        }
      }
    }

    return NextResponse.json({ success: true }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Linket profiles delete API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete profile",
      },
      { status: 500 }
    );
  }
}

