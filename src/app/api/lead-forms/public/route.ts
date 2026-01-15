import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createDefaultLeadFormConfig, normalizeLeadFormConfig } from "@/lib/lead-form";
import { getActiveProfileForPublicHandle } from "@/lib/profile-service";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import type { LeadFormConfig } from "@/types/lead-form";

type LeadFormRow = {
  id: string;
  handle: string | null;
  status: "draft" | "published";
  config: LeadFormConfig;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const handle = searchParams.get("handle");

    if (!handle) {
      return NextResponse.json(
        { error: "handle is required" },
        { status: 400 }
      );
    }

    const supabase = isSupabaseAdminAvailable
      ? supabaseAdmin
      : await createServerSupabase();
    let { data, error } = await supabase
      .from("lead_forms")
      .select("id, handle, status, config")
      .eq("handle", handle)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw new Error(error.message);

    if (!data && isSupabaseAdminAvailable) {
      const payload = await getActiveProfileForPublicHandle(handle);
      if (payload) {
        const now = new Date().toISOString();
        const config = createDefaultLeadFormConfig(`form-${handle}`);
        const { data: created, error: createError } = await supabaseAdmin
          .from("lead_forms")
          .insert({
            user_id: payload.profile.user_id,
            profile_id: payload.profile.id,
            handle,
            status: "published",
            title: config.title,
            description: config.description,
            config,
            created_at: now,
            updated_at: now,
          })
          .select("id, handle, status, config")
          .single();
        if (createError) throw new Error(createError.message);
        data = created;
      }
    }

    if (!data) {
      return NextResponse.json({ form: null }, { status: 200 });
    }

    let resolvedConfig = (data as LeadFormRow).config;
    if (isSupabaseAdminAvailable && (data as LeadFormRow).status !== "published") {
      resolvedConfig = normalizeLeadFormConfig(
        (data as LeadFormRow).config,
        (data as LeadFormRow).id
      );
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("lead_forms")
        .update({ status: "published", config: resolvedConfig, updated_at: now })
        .eq("id", (data as LeadFormRow).id);
    }

    const form = normalizeLeadFormConfig(
      resolvedConfig,
      (data as LeadFormRow).id
    );

    return NextResponse.json(
      { form, formId: (data as LeadFormRow).id },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("Lead form public fetch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load lead form",
      },
      { status: 500 }
    );
  }
}
