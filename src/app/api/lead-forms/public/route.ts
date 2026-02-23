import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { normalizeLeadFormConfig } from "@/lib/lead-form";
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

    const supabase = await createServerSupabaseReadonly();
    const { data, error } = await supabase
      .from("lead_forms")
      .select("id, handle, status, config")
      .eq("handle", handle)
      .eq("status", "published")
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw new Error(error.message);

    if (!data) {
      return NextResponse.json({ form: null }, { status: 200 });
    }

    const form = normalizeLeadFormConfig(
      (data as LeadFormRow).config,
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
