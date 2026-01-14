import { NextResponse } from "next/server";
import { buildVCard } from "@/lib/vcard/buildVCard";
import { getActiveProfileForPublicHandle } from "@/lib/profile-service";
import type { ContactProfile } from "@/lib/profile.store";
import { createClient } from "@supabase/supabase-js";

type VCardRecord = {
  full_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
  address: string | null;
  note: string | null;
  photo_data: string | null;
  photo_name: string | null;
};

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" "),
  };
}

function buildContactProfile(
  handle: string,
  record: VCardRecord | null,
  fallbackName: string
): ContactProfile {
  const name = record?.full_name?.trim() || fallbackName;
  const { firstName, lastName } = splitName(name);
  return {
    handle,
    firstName,
    lastName,
    org: record?.company ?? undefined,
    title: record?.title ?? undefined,
    emails: record?.email
      ? [{ value: record.email, type: "work", pref: true }]
      : undefined,
    phones: record?.phone
      ? [{ value: record.phone, type: "cell", pref: true }]
      : undefined,
    website: record?.website ?? undefined,
    note: record?.note ?? undefined,
    address: record?.address ? { street: record.address } : undefined,
    photo: record?.photo_data
      ? { dataUrl: record.photo_data }
      : undefined,
    uid: `urn:uuid:${handle}`,
    updatedAt: new Date().toISOString(),
  };
}

function createPublicClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: rawHandle } = await params;
    const handle = rawHandle?.trim().toLowerCase();
    if (!handle) {
      return NextResponse.json({ error: "Handle required" }, { status: 400 });
    }

    const payload = await getActiveProfileForPublicHandle(handle);
    if (!payload) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { account, profile } = payload;
    const fallbackName =
      profile.name || account.display_name || profile.handle || handle;

    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("vcard_profiles")
      .select(
        "full_name,title,email,phone,company,website,address,note,photo_data,photo_name"
      )
      .eq("user_id", account.user_id)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;

    const contactProfile = buildContactProfile(
      handle,
      (data as VCardRecord | null) ?? null,
      fallbackName
    );
    const vcard = buildVCard(contactProfile);

    return new NextResponse(vcard, {
      status: 200,
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${handle}.vcf\"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to build vCard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
