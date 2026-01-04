import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type VCardFields = {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  address: string;
  note: string;
  photoData: string | null;
  photoName: string | null;
};

const EMPTY_FIELDS: VCardFields = {
  fullName: "",
  title: "",
  email: "",
  phone: "",
  company: "",
  website: "",
  address: "",
  note: "",
  photoData: null,
  photoName: null,
};

async function requireUser(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const user = await requireUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const userId = params.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("vcard_profiles")
      .select(
        "full_name,title,email,phone,company,website,address,note,photo_data,photo_name"
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;

    if (!data) {
      return NextResponse.json({ fields: EMPTY_FIELDS }, { status: 200 });
    }

    const payload: VCardFields = {
      fullName: data.full_name ?? "",
      title: data.title ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
      company: data.company ?? "",
      website: data.website ?? "",
      address: data.address ?? "",
      note: data.note ?? "",
      photoData: data.photo_data ?? null,
      photoName: data.photo_name ?? null,
    };

    return NextResponse.json({ fields: payload }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const user = await requireUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      userId?: string;
      fields?: VCardFields;
    };

    if (!body.userId || !body.fields) {
      return NextResponse.json(
        { error: "userId and fields are required" },
        { status: 400 }
      );
    }
    if (body.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { fields } = body;
    const payload = {
      user_id: body.userId,
      full_name: fields.fullName?.trim() || null,
      title: fields.title?.trim() || null,
      email: fields.email?.trim() || null,
      phone: fields.phone?.trim() || null,
      company: fields.company?.trim() || null,
      website: fields.website?.trim() || null,
      address: fields.address?.trim() || null,
      note: fields.note?.trim() || null,
      photo_data: fields.photoData ?? null,
      photo_name: fields.photoName ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("vcard_profiles")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw error;

    return NextResponse.json({ fields }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
