import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const pathParam = req.nextUrl.searchParams.get("path");
  if (!pathParam) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  const w = Number(req.nextUrl.searchParams.get("w") || "0");
  const q = Number(req.nextUrl.searchParams.get("q") || "80");
  const expires = Number(req.nextUrl.searchParams.get("exp") || "3600"); // 1h

  // basic sanitization
  if (pathParam.includes("..")) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  if (!isSupabaseAdminAvailable) {
    return NextResponse.json({ error: "Supabase admin unavailable" }, { status: 503 });
  }

  try {
    const transform = w > 0 ? { width: w, quality: Math.min(Math.max(q, 1), 100), resize: 'cover' as const } : undefined;
    const { data, error } = await supabaseAdmin
      .storage
      .from('avatars')
      .createSignedUrl(pathParam, expires, transform ? { transform } : undefined);
    if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message || 'Failed to sign url' }, { status: 400 });
    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

