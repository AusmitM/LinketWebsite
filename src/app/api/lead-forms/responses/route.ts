import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const formId = searchParams.get("formId");

    if (!userId || !formId) {
      return NextResponse.json(
        { error: "userId and formId are required" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (authData.user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
