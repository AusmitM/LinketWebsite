import { NextRequest, NextResponse } from "next/server";
import { getProfile, type ContactProfile } from "@/lib/profile.store";
import { buildVCard } from "@/lib/vcard/buildVCard";
import { getActiveProfileForPublicHandle } from "@/lib/profile-service";

type Params = { handle: string };

export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  const params = await ctx.params;
  const handle = decodeURIComponent(params.handle || "");
  if (!handle) return new NextResponse("Missing handle", { status: 400 });

  let profile = await getProfile(handle);
  if (!profile) {
    // Fallback: build a minimal vCard from the active public profile (if present)
    const fallback = await getActiveProfileForPublicHandle(handle);
    if (fallback) {
      const { account, profile: activeProfile } = fallback;
      const name = activeProfile.name?.trim() || account.username || handle;
      profile = {
        handle: account.username,
        firstName: name,
        lastName: "",
        note: activeProfile.headline || undefined,
        emails: [],
        phones: [],
        address: {},
        uid: activeProfile.id || `urn:uuid:${account.username}`,
        updatedAt: activeProfile.updated_at || new Date().toISOString(),
      } as ContactProfile;
    } else {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  const body = buildVCard(profile);
  const headers = new Headers({
    "Content-Type": "text/vcard; charset=utf-8",
    "Content-Disposition": `attachment; filename="${encodeURIComponent(handle)}.vcf"`,
    "Cache-Control": "no-store",
  });
  return new NextResponse(body, { status: 200, headers });
}
