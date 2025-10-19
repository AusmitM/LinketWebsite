import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
// import { getServerSession } from "SERVER_SESSION_HELPER"; // TODO: replace session getter

export async function GET() {
  // TODO: Replace with real session getter
  const session = { user: { id: "mock-user-id" } };
  if (!session || !session.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: assignments } = await supabaseAdmin
    .from("tag_assignments")
    .select("id, tag_id, nickname, target_type, target_url, profile_id, created_at, updated_at, hardware_tags!inner(id, public_token, status)")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: true });

  const { data: profiles } = await supabaseAdmin
    .from("user_profiles")
    .select("id, handle, title, is_active")
    .eq("user_id", session.user.id)
    .order("created_at");

  return NextResponse.json({
    linkets: (assignments ?? []).map(a => {
      let hardware_tags: Record<string, unknown> | null = null;
      if (Array.isArray(a.hardware_tags)) {
        hardware_tags = a.hardware_tags[0] ?? null;
      } else if (typeof a.hardware_tags === "object" && a.hardware_tags !== null) {
        hardware_tags = a.hardware_tags as Record<string, unknown>;
      }
      return {
        assignment_id: a.id,
        tag_id: a.tag_id,
        token: typeof hardware_tags?.public_token === "string" ? hardware_tags.public_token : "",
        status: typeof hardware_tags?.status === "string" ? hardware_tags.status : "",
        nickname: a.nickname,
        target_type: typeof a.target_type === "string" ? a.target_type : "profile",
        target_url: a.target_url,
        profile_id: a.profile_id,
      };
    }),
    profiles: profiles ?? [],
  });
}
