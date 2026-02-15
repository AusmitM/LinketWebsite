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

type AssignmentLookup = {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  target_type: "profile" | "url" | null;
  target_url: string | null;
};

async function recordScan(
  req: NextRequest,
  tagId: string,
  assignment: AssignmentLookup | null
) {
  const now = new Date().toISOString();
  const ownerUserId = assignment?.user_id ?? null;
  const ownerProfileId = assignment?.profile_id ?? null;
  const metadata = {
    assignment_id: assignment?.id ?? null,
    owner_profile_id: ownerProfileId,
    owner_user_id: ownerUserId,
    // Legacy aliases kept for older analytics readers.
    profile_id: ownerProfileId,
    user_id: ownerUserId,
    referrer: req.headers.get("referer"),
    user_agent: req.headers.get("user-agent"),
    path: req.nextUrl.pathname,
  };

  const scanInsert = supabaseAdmin.from("tag_events").insert({
    tag_id: tagId,
    event_type: "scan",
    metadata,
    occurred_at: now,
  });

  const redirectUpdate = assignment?.id
    ? supabaseAdmin
        .from("tag_assignments")
        .update({ last_redirected_at: now })
        .eq("id", assignment.id)
    : Promise.resolve({ error: null });

  const [scanResult, redirectResult] = await Promise.all([
    scanInsert,
    redirectUpdate,
  ]);

  if (scanResult.error) {
    console.warn("linket-scan-log failed:", scanResult.error.message);
  }
  if (redirectResult.error) {
    console.warn(
      "linket-last-redirect update failed:",
      redirectResult.error.message
    );
  }
}

type ResolvedProfileTarget = {
  profileId: string | null;
  handle: string | null;
};

type OverrideLinkTarget = {
  linkId: string;
  url: string;
};

async function resolveAssignmentProfileTarget(assignment: {
  profile_id?: string | null;
  user_id?: string | null;
}): Promise<ResolvedProfileTarget> {
  if (assignment.profile_id) {
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("id,handle")
      .eq("id", assignment.profile_id)
      .limit(1)
      .maybeSingle();
    const handle = normalizeHandle(profile?.handle);
    if (handle) {
      return {
        profileId: (profile as { id?: string | null } | null)?.id ?? null,
        handle,
      };
    }
  }

  if (assignment.user_id) {
    const { data: activeProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("id,handle")
      .eq("user_id", assignment.user_id)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const handle = normalizeHandle(activeProfile?.handle);
    if (handle) {
      return {
        profileId:
          (activeProfile as { id?: string | null } | null)?.id ?? null,
        handle,
      };
    }
  }

  return { profileId: null, handle: null };
}

async function resolveProfileOverrideLink(
  profileId: string
): Promise<OverrideLinkTarget | null> {
  const { data, error } = await supabaseAdmin
    .from("profile_links")
    .select("id,url")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .eq("is_override", true)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("linket-override lookup failed:", error.message);
    return null;
  }
  if (!data?.url || !data?.id) return null;

  try {
    return {
      linkId: data.id as string,
      url: sanitizeHttpUrl(data.url as string),
    };
  } catch {
    return null;
  }
}

async function incrementOverrideLinkClick(linkId: string) {
  const { error } = await supabaseAdmin.rpc("increment_profile_link_click", {
    p_link_id: linkId,
  });
  if (error) {
    console.warn("linket-override click increment failed:", error.message);
  }
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

  if (!assignmentError) {
    await recordScan(req, tag.id, (assignment as AssignmentLookup | null) ?? null);
  } else {
    await recordScan(req, tag.id, null);
  }

  if (!assignmentError && assignment) {
    if (assignment.target_type === "url" && assignment.target_url) {
      try {
        return NextResponse.redirect(sanitizeHttpUrl(assignment.target_url));
      } catch {
        // fall through to profile redirect
      }
    }

    const target = await resolveAssignmentProfileTarget(assignment);
    if (target.profileId) {
      const override = await resolveProfileOverrideLink(target.profileId);
      if (override) {
        await incrementOverrideLinkClick(override.linkId);
        return NextResponse.redirect(override.url);
      }
    }
    if (target.handle) return redirectTo(req, `/${target.handle}`);
  }

  return redirectTo(req, "/dashboard/linkets");
}
