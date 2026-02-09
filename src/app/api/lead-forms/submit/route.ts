import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import { validateSubmission } from "@/lib/lead-form";
import { limitRequest } from "@/lib/rate-limit";
import { recordConversionEvent } from "@/lib/server-conversion-events";
import type { LeadFormConfig, LeadFormSubmission } from "@/types/lead-form";

type LeadFormRow = {
  id: string;
  user_id: string;
  handle: string | null;
  status: "draft" | "published";
  config: LeadFormConfig;
};

function shouldRetryWithoutToken(message: string) {
  const lowered = message.toLowerCase();
  return lowered.includes("response_token") || lowered.includes("schema cache");
}

async function insertLeadFormResponse(
  client: typeof supabaseAdmin,
  payload: {
    form_id: string;
    response_id: string;
    response_token?: string;
    submitted_at: string;
    answers: LeadFormSubmission["answers"];
    responder_email: string | null;
  }
) {
  const { error } = await client.from("lead_form_responses").insert(payload);
  if (!error) return;
  if (payload.response_token && shouldRetryWithoutToken(error.message)) {
    const fallback = { ...payload };
    delete (fallback as { response_token?: string }).response_token;
    const { error: retryError } = await client
      .from("lead_form_responses")
      .insert(fallback);
    if (!retryError) return;
    throw new Error(retryError.message);
  }
  throw new Error(error.message);
}

function mapLeadFields(
  answers: LeadFormSubmission["answers"],
  config: LeadFormConfig
) {
  const fieldsById = new Map(config.fields.map((field) => [field.id, field]));
  const values: Record<string, unknown> = {};
  for (const [fieldId, entry] of Object.entries(answers)) {
    const field = fieldsById.get(fieldId);
    if (!field) continue;
    const label = field.label?.trim() || fieldId;
    const safeLabel = label.replace(/::/g, " ").trim() || fieldId;
    values[`${safeLabel}::${fieldId}`] = entry.value;
  }
  return values;
}

function inferLeadFields(
  answers: LeadFormSubmission["answers"],
  config: LeadFormConfig
) {
  const labelMap = new Map(
    config.fields.map((field) => [field.id, field.label.toLowerCase()])
  );
  const findByLabel = (needle: string) => {
    for (const [id, label] of labelMap.entries()) {
      if (label.includes(needle)) return answers[id]?.value ?? null;
    }
    return null;
  };
  return {
    name: (findByLabel("name") as string | null) ?? null,
    email: (findByLabel("email") as string | null) ?? null,
    phone: (findByLabel("phone") as string | null) ?? null,
    company: (findByLabel("company") as string | null) ?? null,
    message: (findByLabel("message") as string | null) ?? null,
  };
}

function normaliseSourceUrl(value: unknown, fallback: string | null) {
  for (const candidate of [value, fallback]) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }
      return parsed.toString().slice(0, 2048);
    } catch {
      // Ignore invalid URLs.
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (await limitRequest(request, "lead-form-submit", 20, 60_000)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      formId,
      responseId,
      answers,
      responderEmail,
      pageUrl,
    } = body as {
      formId?: string;
      responseId?: string;
      answers?: LeadFormSubmission["answers"];
      responderEmail?: string | null;
      pageUrl?: string | null;
    };

    if (!formId || !answers) {
      return NextResponse.json(
        { error: "formId and answers are required" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    const { data: formRow, error: formError } = await supabase
      .from("lead_forms")
      .select("id,user_id,handle,status,config")
      .eq("id", formId)
      .maybeSingle();
    if (formError) throw new Error(formError.message);
    if (!formRow) {
      return NextResponse.json(
        { error: "Form not available" },
        { status: 404 }
      );
    }

    const formPayload = formRow as LeadFormRow;
    if (formPayload.status !== "published") {
      return NextResponse.json(
        { error: "Form not available" },
        { status: 403 }
      );
    }
    const config = formPayload.config;
    const validationErrors = validateSubmission(config, answers);
    if (validationErrors.length) {
      return NextResponse.json(
        { error: "Validation failed", fields: validationErrors },
        { status: 400 }
      );
    }

    const resolvedResponseId =
      responseId || crypto.randomUUID?.() || `resp_${Date.now()}`;
    const now = new Date().toISOString();

    const responseToken =
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? (crypto as Crypto).randomUUID?.()
        : null) || `tok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payload = {
      form_id: formId,
      response_id: resolvedResponseId,
      response_token: responseToken,
      submitted_at: now,
      answers,
      responder_email: responderEmail ?? null,
    };

    if (isSupabaseAdminAvailable) {
      await insertLeadFormResponse(supabaseAdmin, payload);
    } else {
      await insertLeadFormResponse(supabase as typeof supabaseAdmin, payload);
    }

    const leadValues = inferLeadFields(answers, config);
    const emailValue = leadValues.email || responderEmail || null;
    const sourceUrl = normaliseSourceUrl(pageUrl, request.headers.get("referer"));
    if (leadValues.name && emailValue) {
      const { error: leadError } = await supabase
        .from("leads")
        .insert({
          user_id: (formRow as LeadFormRow).user_id,
          handle: (formRow as LeadFormRow).handle || "public",
          name: leadValues.name,
          email: emailValue,
          phone: leadValues.phone,
          company: leadValues.company,
          message: leadValues.message,
          source_url: sourceUrl,
          custom_fields: mapLeadFields(answers, config),
        });
      if (leadError) {
        console.warn("Lead insert failed:", leadError.message);
      } else {
        await recordConversionEvent({
          eventId: "lead_captured",
          userId: formPayload.user_id,
          eventSource: "server",
          meta: {
            formId,
            handle: formPayload.handle,
          },
        });
      }
    }

    return NextResponse.json({
      responseId: resolvedResponseId,
      responseToken,
      submittedAt: now,
    });
  } catch (error) {
    console.error("Lead form submit error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to submit response",
      },
      { status: 500 }
    );
  }
}
