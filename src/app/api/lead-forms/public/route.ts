import { NextRequest, NextResponse } from "next/server";
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

    const { form, formId } = await getPublishedLeadForm({ handle, profileId });
    if (!form || !formId) {
      return NextResponse.json({ form: null }, { status: 200 });
    }

    return NextResponse.json(
      { form, formId },
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
