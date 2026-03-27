import { NextRequest, NextResponse } from "next/server";
import { applyFreeLeadFormLimits } from "@/lib/lead-form";
import { getDashboardPlanAccessForUser } from "@/lib/plan-access.server";
import { getPublishedLeadForm } from "@/lib/public-lead-form";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const handle = searchParams.get("handle");
    const profileId = searchParams.get("profileId");

    if (!handle && !profileId) {
      return NextResponse.json(
        { error: "handle or profileId is required" },
        { status: 400 }
      );
    }

    const { form, formId, row } = await getPublishedLeadForm({ handle, profileId });
    if (!form || !formId || !row?.user_id) {
      return NextResponse.json({ form: null }, { status: 200 });
    }

    const planAccess = await getDashboardPlanAccessForUser(row.user_id);
    const resolvedForm = planAccess.canCustomizeLeadForm
      ? form
      : applyFreeLeadFormLimits(form, formId);

    return NextResponse.json(
      { form: resolvedForm, formId },
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
