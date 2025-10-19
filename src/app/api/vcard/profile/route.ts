import { NextRequest, NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/profile.store";
import { getAccountHandleForUser } from "@/lib/profile-service";
import type { ContactProfile } from "@/lib/profile.store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  try {
    const handle = await getAccountHandleForUser(userId);
    if (!handle) {
      return NextResponse.json({ error: "No account handle" }, { status: 404 });
    }
    const profile = (await getProfile(handle)) ?? buildDefaultProfile(handle);
    return NextResponse.json({ fields: contactToVCardFields(profile) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load vCard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; fields?: VCardFieldsPayload };
    if (!body?.userId || !body?.fields) {
      return NextResponse.json({ error: "userId and fields are required" }, { status: 400 });
    }
    const handle = await getAccountHandleForUser(body.userId);
    if (!handle) {
      return NextResponse.json({ error: "No account handle" }, { status: 404 });
    }
    const profilePayload = vCardFieldsToContactProfile(handle, body.fields);
    const saved = await saveProfile(profilePayload);
    return NextResponse.json({ fields: contactToVCardFields(saved) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save vCard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type VCardFieldsPayload = {
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

function buildDefaultProfile(handle: string): ContactProfile {
  return {
    handle,
    firstName: "",
    lastName: "",
    org: "",
    title: "",
    emails: [],
    phones: [],
    address: { street: "" },
    website: "",
    note: "",
    photo: null,
  };
}

function contactToVCardFields(profile: ContactProfile): VCardFieldsPayload {
  const fullName = [profile.prefix, profile.firstName, profile.middleName, profile.lastName, profile.suffix]
    .filter(Boolean)
    .join(" ")
    .trim();
  const email = profile.emails?.[0]?.value ?? "";
  const phone = profile.phones?.[0]?.value ?? "";
  const website = profile.website ?? "";
  const note = profile.note ?? "";
  const address = profile.address?.street ?? "";
  const photoData = profile.photo?.dataUrl ?? profile.photo?.url ?? null;
  const photoName = photoData ? profile.photo?.mime ?? profile.photo?.url ?? "photo" : null;

  return {
    fullName,
    title: profile.title ?? "",
    email,
    phone,
    company: profile.org ?? "",
    website,
    address,
    note,
    photoData,
    photoName,
  };
}

function vCardFieldsToContactProfile(handle: string, fields: VCardFieldsPayload): ContactProfile {
  const nameParts = fields.fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() ?? "";
  const lastName = nameParts.pop() ?? "";
  const middleName = nameParts.length ? nameParts.join(" ") : undefined;
  const emails = fields.email ? [{ value: fields.email, type: "work" as const, pref: true }] : [];
  const phones = fields.phone ? [{ value: fields.phone, type: "cell" as const, pref: true }] : [];
  const address = fields.address
    ? {
        street: fields.address,
      }
    : undefined;
  const photo = fields.photoData ? { dataUrl: fields.photoData, mime: guessMime(fields.photoData) } : null;

  return {
    handle,
    firstName,
    lastName,
    middleName,
    title: fields.title || undefined,
    org: fields.company || undefined,
    note: fields.note || undefined,
    website: fields.website || undefined,
    emails,
    phones,
    address,
    photo,
  };
}

function guessMime(dataUrl: string | null): string | undefined {
  if (!dataUrl) return undefined;
  const match = /^data:([^;]+);/.exec(dataUrl);
  return match ? match[1] : undefined;
}
