import { NextRequest, NextResponse } from "next/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import { sanitizeHttpUrl } from "@/lib/security";

const CLAIMABLE_STATUSES = new Set(["unclaimed", "claimable"]);

function redirectTo(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url));
}

function normalizeHandle(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

async function resolveAssignmentHandle(assignment: {
  profile_id?: string | null;
  user_id?: string | null;
}) {
  if (assignment.profile_id) {
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("handle")
      .eq("id", assignment.profile_id)
      .limit(1)
      .maybeSingle();
    const handle = normalizeHandle(profile?.handle);
    if (handle) return handle;
  }

  if (assignment.user_id) {
    const { data: activeProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("handle")
      .eq("user_id", assignment.user_id)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const handle = normalizeHandle(activeProfile?.handle);
    if (handle) return handle;
  }

  if (assignment.user_id) {
    const { data: account } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("user_id", assignment.user_id)
      .limit(1)
      .maybeSingle();
    const handle = normalizeHandle(account?.username);
    if (handle) return handle;
  }

  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params;
  const token = rawToken?.trim();
  if (!token) return redirectTo(req, "/");
  if (!isSupabaseAdminAvailable) return redirectTo(req, "/");

  const { data: tag, error: tagError } = await supabaseAdmin
    .from("hardware_tags")
    .select("id,status,public_token")
    .eq("public_token", token)
    .limit(1)
    .maybeSingle();

  if (tagError || !tag) {
    return redirectTo(req, "/");
  }

  if (CLAIMABLE_STATUSES.has(tag.status)) {
    return redirectTo(req, `/dashboard/linkets?claim=${encodeURIComponent(token)}`);
  }

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("tag_assignments")
    .select("id,user_id,profile_id,target_type,target_url")
    .eq("tag_id", tag.id)
    .limit(1)
    .maybeSingle();

  if (!assignmentError && assignment) {
    if (assignment.target_type === "url" && assignment.target_url) {
      try {
        return NextResponse.redirect(sanitizeHttpUrl(assignment.target_url));
      } catch {
        // fall through to profile redirect
      }
    }

    const handle = await resolveAssignmentHandle(assignment);
    if (handle) return redirectTo(req, `/${handle}`);
  }

  return redirectTo(req, "/dashboard/linkets");
}
