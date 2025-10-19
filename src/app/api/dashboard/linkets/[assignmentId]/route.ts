import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sanitizeHttpUrl } from "@/lib/security";
// import { getServerSession } from "SERVER_SESSION_HELPER"; // TODO: replace session getter

const Body = z.object({
  nickname: z.string().max(80).optional(),
  target_type: z.enum(["profile","url"]).optional(),
  profile_id: z.string().uuid().nullable().optional(),
  target_url: z.string().url().nullable().optional(),
});

export async function PATCH(req: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const params = await context.params;
  // TODO: Add session validation when available

  const body = await req.json().catch(()=>null);
  const p = Body.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "bad_input" }, { status: 400 });

  const { data: a } = await supabaseAdmin
    .from("tag_assignments")
    .select("id, user_id, tag_id, profile_id, nickname, target_type, target_url, hardware_tags(id, public_token)")
    .eq("id", params.assignmentId)
    .single();
  if (!a) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const next: Record<string, unknown> = {};
  if (p.data.nickname !== undefined) next.nickname = p.data.nickname;
  if (p.data.target_type) next.target_type = p.data.target_type;

  if (p.data.target_type === "profile") {
    if (p.data.profile_id) {
      const { data: prof } = await supabaseAdmin.from("user_profiles").select("id").eq("id", p.data.profile_id).single();
      if (!prof) return NextResponse.json({ error: "bad_profile" }, { status: 400 });
      next.profile_id = p.data.profile_id;
    } else next.profile_id = null; // fallback to primary at redirect time
    next.target_url = null;
  }

  if (p.data.target_type === "url") {
    if (!p.data.target_url) return NextResponse.json({ error: "url_required" }, { status: 400 });
    try { next.target_url = sanitizeHttpUrl(p.data.target_url); } catch { return NextResponse.json({ error: "invalid_url" }, { status: 400 }); }
    next.profile_id = null;
  }

  const { error } = await supabaseAdmin.from("tag_assignments").update(next).eq("id", params.assignmentId);
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });

  await supabaseAdmin.from("tag_events").insert({ tag_id: a.tag_id, event_type: "target_change", metadata: next });
  // Handle hardware_tags as array only
  let token = "";
  if (Array.isArray(a.hardware_tags) && a.hardware_tags.length > 0 && typeof a.hardware_tags[0].public_token === "string") {
    token = a.hardware_tags[0].public_token;
  }
  await fetch(`/api/internal/purge-cache?token=${encodeURIComponent(token)}`, { method:"POST", headers:{ "x-internal-secret": process.env.INTERNAL_SECRET! }});

  return NextResponse.json({ ok: true });
}
