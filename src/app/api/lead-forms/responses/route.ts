import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRouteAccess } from "@/lib/api-authorization";
import { sanitizeSubmissionAnswers } from "@/lib/lead-form";
import { getPlanScopedLeadFormConfig } from "@/lib/lead-form.server";
import { validateSearchParams } from "@/lib/request-validation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { LeadFormConfig, LeadFormSubmission } from "@/types/lead-form";

const leadFormResponsesQuerySchema = z.object({
  formId: z.string().trim().min(1).max(120),
  userId: z.string().uuid(),
});

type LeadFormRow = {
  id: string;
  user_id: string;
  config: LeadFormConfig | null;
};

type LeadFormResponseRow = {
  response_id: string;
  submitted_at: string | null;
  updated_at: string | null;
  answers: LeadFormSubmission["answers"] | null;
  responder_email: string | null;
};

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
    const { data: formRow, error: formError } = await supabase
      .from("lead_forms")
      .select("id,user_id,config")
      .eq("id", formId)
      .eq("user_id", userId)
      .maybeSingle();
    if (formError) throw new Error(formError.message);
    if (!formRow) {
      return NextResponse.json({ responses: [] }, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    const typedFormRow = formRow as LeadFormRow;
    const { config } = await getPlanScopedLeadFormConfig(
      userId,
      typedFormRow.config,
      formId
    );

    const { data, error } = await supabase
      .from("lead_form_responses")
      .select("response_id, submitted_at, updated_at, answers, responder_email")
      .eq("form_id", formId)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);

    return NextResponse.json(
      {
        responses: ((data ?? []) as LeadFormResponseRow[]).map((response) => ({
          ...response,
          answers: sanitizeSubmissionAnswers(config, response.answers).answers,
        })),
      },
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
