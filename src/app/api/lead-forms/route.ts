import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import {
  createDefaultLeadFormConfig,
  normalizeLeadFormConfig,
} from "@/lib/lead-form";
import type {
  LeadFormConfig,
  LeadFormField,
} from "@/types/lead-form";

type LeadFormRow = {
  id: string;
  user_id: string;
  profile_id: string | null;
  handle: string | null;
  status: "draft" | "published";
  title: string | null;
  description: string | null;
  config: LeadFormConfig;
  created_at: string;
  updated_at: string;
};

async function ensureAuthedUser(userId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { supabase, ok: false, error: "Unauthorized" };
  }
  if (data.user.id !== userId) {
    return { supabase, ok: false, error: "Forbidden" };
  }
  return { supabase, ok: true };
}

function buildLegacyConfig(
  handle: string,
  fields: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    options: string[] | null;
    validation: { minLength?: number | null; emailFormat?: boolean } | null;
    placeholder?: string | null;
  }>,
  settings: Record<string, unknown> | null
): LeadFormConfig {
  const config = createDefaultLeadFormConfig(`legacy-${handle}`);
  config.title = "Lead capture";
  config.description = "";
  config.status = settings?.published ? "published" : "draft";
  config.settings.confirmationMessage =
    (settings?.successMessage as string | undefined) ||
    config.settings.confirmationMessage;
  config.fields = fields.map((field) => {
    const base: Partial<LeadFormField> = {
      id: field.id,
      label: field.label,
      required: field.required,
      helpText: "",
      validation: { rule: "none" },
    };
    if (field.type === "textarea") {
      return { ...base, type: "long_text" } as LeadFormField;
    }
    if (field.type === "select") {
      return {
        ...base,
        type: "dropdown",
        options: (field.options || []).map((opt, idx) => ({
          id: `${field.id}-opt-${idx}`,
          label: opt,
        })),
        allowOther: false,
        otherLabel: "Other",
        presentation: { shuffleOptions: false },
      } as LeadFormField;
    }
    if (field.type === "checkbox") {
      return {
        ...base,
        type: "checkboxes",
        options: [
          {
            id: `${field.id}-opt-0`,
            label: field.placeholder || "Yes",
          },
        ],
        allowOther: false,
        otherLabel: "Other",
        presentation: { shuffleOptions: false },
      } as LeadFormField;
    }
    const validationRule =
      field.type === "email" || field.validation?.emailFormat
        ? "email"
        : "none";
    return {
      ...base,
      type: "short_text",
      validation:
        field.validation?.minLength
          ? { rule: "min_length", value: field.validation.minLength }
          : { rule: validationRule },
    } as LeadFormField;
  });
  return config;
}

async function fetchLegacyConfig(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  handle: string
): Promise<LeadFormConfig | null> {
  const { data: fields, error: fieldsError } = await supabase
    .from("lead_form_fields")
    .select("id,label,type,required,options,validation,placeholder")
    .eq("user_id", userId)
    .eq("handle", handle)
    .eq("is_active", true)
    .order("order_index", { ascending: true });
  if (fieldsError) return null;
  const { data: settings } = await supabase
    .from("lead_form_settings")
    .select("settings")
    .eq("user_id", userId)
    .eq("handle", handle)
    .maybeSingle();
  if (!fields?.length) return null;
  return buildLegacyConfig(
    handle,
    fields as Array<{
      id: string;
      label: string;
      type: string;
      required: boolean;
      options: string[] | null;
      validation: { minLength?: number | null; emailFormat?: boolean } | null;
      placeholder?: string | null;
    }>,
    (settings?.settings as Record<string, unknown>) || null
  );
}

async function getResponseStats(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  formId: string
) {
  const { count, error } = await supabase
    .from("lead_form_responses")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId);
  if (error) return { count: 0, lastSubmittedAt: null };
  const { data: latest } = await supabase
    .from("lead_form_responses")
    .select("submitted_at")
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false })
    .limit(1);
  return {
    count: count ?? 0,
    lastSubmittedAt: latest?.[0]?.submitted_at ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const handle = searchParams.get("handle");
    const profileId = searchParams.get("profileId");

    if (!userId || (!handle && !profileId)) {
      return NextResponse.json(
        { error: "userId and handle or profileId are required" },
        { status: 400 }
      );
    }

    const { supabase, ok, error } = await ensureAuthedUser(userId);
    if (!ok) return NextResponse.json({ error }, { status: 401 });

    let query = supabase.from("lead_forms").select("*").eq("user_id", userId);
    if (profileId) query = query.eq("profile_id", profileId);
    if (handle) query = query.eq("handle", handle);
    const { data, error: formError } = await query.maybeSingle();
    if (formError && formError.code !== "PGRST116") {
      throw new Error(formError.message);
    }

    let config: LeadFormConfig | null = null;
    let formRow: LeadFormRow | null = (data as LeadFormRow) || null;

    if (!formRow && handle) {
      config = await fetchLegacyConfig(supabase, userId, handle);
      if (config) {
        formRow = {
          id: config.id,
          user_id: userId,
          profile_id: profileId || null,
          handle,
          status: config.status,
          title: config.title,
          description: config.description,
          config,
          created_at: config.meta.createdAt,
          updated_at: config.meta.updatedAt,
        };
      }
    }

    const resolvedConfig = normalizeLeadFormConfig(
      formRow?.config,
      formRow?.id || `form-${userId}`
    );

    const stats = formRow?.id
      ? await getResponseStats(supabase, formRow.id)
      : { count: 0, lastSubmittedAt: null };

    return NextResponse.json(
      {
        form: resolvedConfig,
        meta: {
          formId: formRow?.id || resolvedConfig.id,
          stats,
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Lead form fetch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load lead form",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      handle,
      profileId,
      config,
    } = body as {
      userId?: string;
      handle?: string;
      profileId?: string | null;
      config?: LeadFormConfig;
    };

    if (!userId || !handle || !config) {
      return NextResponse.json(
        { error: "userId, handle, and config are required" },
        { status: 400 }
      );
    }

    const { supabase, ok, error } = await ensureAuthedUser(userId);
    if (!ok) return NextResponse.json({ error }, { status: 401 });

    const now = new Date().toISOString();
    const normalized = normalizeLeadFormConfig(config, config.id || handle);
    const nextVersion = (normalized.meta.version || 1) + 1;
    normalized.meta = {
      ...normalized.meta,
      updatedAt: now,
      version: nextVersion,
    };

    const payload = {
      user_id: userId,
      handle,
      profile_id: profileId ?? null,
      status: normalized.status,
      title: normalized.title,
      description: normalized.description,
      config: normalized,
      updated_at: now,
    };

    const { data, error: saveError } = await supabase
      .from("lead_forms")
      .upsert(payload, { onConflict: "user_id,handle" })
      .select("*")
      .single();
    if (saveError) throw new Error(saveError.message);

    if (isSupabaseAdminAvailable) {
      await supabaseAdmin
        .from("lead_forms")
        .update({ config: normalized })
        .eq("id", (data as LeadFormRow).id);
    }

    return NextResponse.json(
      { form: normalized, formId: (data as LeadFormRow).id },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Lead form save error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save lead form",
      },
      { status: 500 }
    );
  }
}
