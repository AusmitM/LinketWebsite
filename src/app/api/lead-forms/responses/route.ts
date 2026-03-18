import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRouteAccess } from "@/lib/api-authorization";
import { validateSearchParams } from "@/lib/request-validation";
import { createServerSupabase } from "@/lib/supabase/server";

const leadFormResponsesQuerySchema = z.object({
  formId: z.string().trim().min(1).max(120),
  userId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const parsedQuery = validateSearchParams(
      request.nextUrl.searchParams,
      leadFormResponsesQuerySchema
    );
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }
    const { formId, userId } = parsedQuery.data;

    const access = await requireRouteAccess("GET /api/lead-forms/responses", {
      resourceUserId: userId,
    });
    if (access instanceof NextResponse) {
      return access;
    }
    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from("lead_form_responses")
      .select("response_id, submitted_at, updated_at, answers, responder_email")
      .eq("form_id", formId)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);

    return NextResponse.json(
      { responses: data ?? [] },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Lead form responses fetch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load responses",
      },
      { status: 500 }
    );
  }
}
