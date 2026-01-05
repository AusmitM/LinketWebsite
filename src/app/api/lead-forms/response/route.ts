import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import { validateSubmission } from "@/lib/lead-form";
import type { LeadFormConfig, LeadFormSubmission } from "@/types/lead-form";

type LeadFormRow = {
  id: string;
  status: "draft" | "published";
  config: LeadFormConfig;
};

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      formId,
      responseId,
      answers,
      responderEmail,
    } = body as {
      formId?: string;
      responseId?: string;
      answers?: LeadFormSubmission["answers"];
      responderEmail?: string | null;
    };

    if (!formId || !responseId || !answers) {
      return NextResponse.json(
        { error: "formId, responseId, and answers are required" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    const { data: formRow, error: formError } = await supabase
      .from("lead_forms")
      .select("id,status,config")
      .eq("id", formId)
      .maybeSingle();
    if (formError) throw new Error(formError.message);
    if (!formRow || (formRow as LeadFormRow).status !== "published") {
      return NextResponse.json(
        { error: "Form not available" },
        { status: 404 }
      );
    }

    const config = (formRow as LeadFormRow).config;
    const validationErrors = validateSubmission(config, answers);
    if (validationErrors.length) {
      return NextResponse.json(
        { error: "Validation failed", fields: validationErrors },
        { status: 400 }
      );
    }

    const payload = {
      answers,
      updated_at: new Date().toISOString(),
      ...(responderEmail ? { responder_email: responderEmail } : {}),
    };

    if (isSupabaseAdminAvailable) {
      const { error: updateError } = await supabaseAdmin
        .from("lead_form_responses")
        .update(payload)
        .eq("form_id", formId)
        .eq("response_id", responseId);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: updateError } = await supabase
        .from("lead_form_responses")
        .update(payload)
        .eq("form_id", formId)
        .eq("response_id", responseId);
      if (updateError) throw new Error(updateError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Lead form response update error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update response",
      },
      { status: 500 }
    );
  }
}
