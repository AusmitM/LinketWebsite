import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest){
  if (req.headers.get("x-internal-secret") !== process.env.INTERNAL_SECRET)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({}, { status: 400 });

  const { data: tag } = await supabaseAdmin
    .from("hardware_tags")
    .select("id, status, public_token, chip_uid")
    .or(`public_token.eq.${token},chip_uid.eq.${token}`)
    .single();
  if (!tag) return NextResponse.json({}, { status: 404 });

  const { data: a } = await supabaseAdmin
    .from("tag_assignments")
    .select("user_id, profile_id, nickname, target_type, target_url")
    .eq("tag_id", tag.id)
    .single();

  const owner_id: string | null = a?.user_id ?? null;
  const target_type: "profile" | "url" = (a?.target_type as "profile"|"url"|undefined) ?? "profile";
  const target_url: string | null = a?.target_url ?? null;
  let target_profile_slug: string | null = null;

  if (a?.profile_id) {
    const { data: prof } = await supabaseAdmin
      .from("user_profiles")
      .select("handle")
      .eq("id", a.profile_id)
      .single();
    target_profile_slug = prof?.handle ?? null;
  }

  return NextResponse.json({ id: tag.id, status: tag.status, owner_id, target_type, target_url, target_profile_slug });
}
