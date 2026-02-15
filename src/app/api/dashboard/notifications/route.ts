import { NextResponse } from "next/server";

import type {
  DashboardAnnouncementRecord,
  DashboardNotificationItem,
} from "@/lib/dashboard-notifications";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 20;
const NOTIFICATION_TABLE = "dashboard_notifications";

function parseLimit(rawValue: string | null) {
  const parsed = Number(rawValue ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsed)));
}

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("could not find the table") ||
    message.includes("does not exist")
  );
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseReadonly();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = parseLimit(new URL(request.url).searchParams.get("limit"));
  const adminLookupClient = isSupabaseAdminAvailable ? supabaseAdmin : supabase;
  const { data: adminRows, error: adminError } = await adminLookupClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .limit(1);
  const isAdmin =
    !adminError && Array.isArray(adminRows) && adminRows.length > 0;

  const audience = isAdmin ? ["all", "admins"] : ["all", "users"];
  const dbClient = isSupabaseAdminAvailable ? supabaseAdmin : supabase;
  const { data, error } = await dbClient
    .from(NOTIFICATION_TABLE)
    .select(
      "id,title,message,severity,audience,is_active,send_as_notification,created_at,updated_at,created_by,updated_by"
    )
    .eq("is_active", true)
    .eq("send_as_notification", true)
    .in("audience", audience)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRelationError(error)) {
      return NextResponse.json({ notifications: [] });
    }
    return NextResponse.json(
      { error: error.message || "Unable to load notifications." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ notifications: [] });
  }

  const notifications: DashboardNotificationItem[] = (
    data as DashboardAnnouncementRecord[]
  ).map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    severity: item.severity,
    createdAt: item.created_at,
  }));

  return NextResponse.json({
    notifications,
  });
}
