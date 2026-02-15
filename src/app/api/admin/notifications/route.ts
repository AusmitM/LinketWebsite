import { NextResponse } from "next/server";

import {
  ANNOUNCEMENT_MESSAGE_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  type DashboardAnnouncementRecord,
  isAnnouncementAudience,
  isAnnouncementSeverity,
  normalizeAnnouncementInput,
} from "@/lib/dashboard-notifications";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const NOTIFICATION_TABLE = "dashboard_notifications";

type AuthContext = {
  userId: string;
  dbClient: Awaited<ReturnType<typeof createServerSupabaseReadonly>> | typeof supabaseAdmin;
};

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

async function requireAdminContext(): Promise<AuthContext | NextResponse> {
  const supabase = await createServerSupabaseReadonly();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminLookupClient = isSupabaseAdminAvailable ? supabaseAdmin : supabase;
  const { data: adminRows, error: adminError } = await adminLookupClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .limit(1);
  if (adminError || !adminRows || adminRows.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return {
    userId: auth.user.id,
    dbClient: isSupabaseAdminAvailable ? supabaseAdmin : supabase,
  };
}

function sanitizePatchPayload(payload: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};

  if ("title" in payload) {
    if (typeof payload.title !== "string") {
      return { ok: false as const, error: "Title must be a string." };
    }
    const title = payload.title.trim();
    if (!title) {
      return { ok: false as const, error: "Title cannot be empty." };
    }
    if (title.length > ANNOUNCEMENT_TITLE_MAX_LENGTH) {
      return {
        ok: false as const,
        error: `Title must be ${ANNOUNCEMENT_TITLE_MAX_LENGTH} characters or fewer.`,
      };
    }
    updates.title = title;
  }

  if ("message" in payload) {
    if (typeof payload.message !== "string") {
      return { ok: false as const, error: "Message must be a string." };
    }
    const message = payload.message.trim();
    if (!message) {
      return { ok: false as const, error: "Message cannot be empty." };
    }
    if (message.length > ANNOUNCEMENT_MESSAGE_MAX_LENGTH) {
      return {
        ok: false as const,
        error: `Message must be ${ANNOUNCEMENT_MESSAGE_MAX_LENGTH} characters or fewer.`,
      };
    }
    updates.message = message;
  }

  if ("severity" in payload) {
    if (typeof payload.severity !== "string" || !isAnnouncementSeverity(payload.severity)) {
      return { ok: false as const, error: "Invalid severity." };
    }
    updates.severity = payload.severity;
  }

  if ("audience" in payload) {
    if (typeof payload.audience !== "string" || !isAnnouncementAudience(payload.audience)) {
      return { ok: false as const, error: "Invalid audience." };
    }
    updates.audience = payload.audience;
  }

  if ("isActive" in payload) {
    if (typeof payload.isActive !== "boolean") {
      return { ok: false as const, error: "isActive must be a boolean." };
    }
    updates.is_active = payload.isActive;
  }

  if ("sendAsNotification" in payload) {
    if (typeof payload.sendAsNotification !== "boolean") {
      return {
        ok: false as const,
        error: "sendAsNotification must be a boolean.",
      };
    }
    updates.send_as_notification = payload.sendAsNotification;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false as const, error: "No updates provided." };
  }

  return { ok: true as const, value: updates };
}

export async function GET(request: Request) {
  const authContext = await requireAdminContext();
  if (authContext instanceof NextResponse) return authContext;

  const limit = parseLimit(new URL(request.url).searchParams.get("limit"));
  const { dbClient } = authContext;
  const { data, error } = await dbClient
    .from(NOTIFICATION_TABLE)
    .select(
      "id,title,message,severity,audience,is_active,send_as_notification,created_at,updated_at,created_by,updated_by"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRelationError(error)) {
      return NextResponse.json(
        { error: "Notifications table is missing. Apply the latest migrations." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Unable to load notifications." },
      { status: 500 }
    );
  }

  return NextResponse.json((data ?? []) as DashboardAnnouncementRecord[]);
}

export async function POST(request: Request) {
  const authContext = await requireAdminContext();
  if (authContext instanceof NextResponse) return authContext;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const parsed = normalizeAnnouncementInput(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { dbClient, userId } = authContext;
  const { value } = parsed;
  const { data, error } = await dbClient
    .from(NOTIFICATION_TABLE)
    .insert({
      title: value.title,
      message: value.message,
      severity: value.severity,
      audience: value.audience,
      is_active: value.isActive,
      send_as_notification: value.sendAsNotification,
      created_by: userId,
      updated_by: userId,
      created_at: now,
      updated_at: now,
    })
    .select(
      "id,title,message,severity,audience,is_active,send_as_notification,created_at,updated_at,created_by,updated_by"
    )
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      return NextResponse.json(
        { error: "Notifications table is missing. Apply the latest migrations." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Unable to create notification." },
      { status: 500 }
    );
  }

  return NextResponse.json(data as DashboardAnnouncementRecord, { status: 201 });
}

export async function PATCH(request: Request) {
  const authContext = await requireAdminContext();
  if (authContext instanceof NextResponse) return authContext;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }

  const sanitized = sanitizePatchPayload(payload);
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  const { dbClient, userId } = authContext;
  const { data, error } = await dbClient
    .from(NOTIFICATION_TABLE)
    .update({
      ...sanitized.value,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(
      "id,title,message,severity,audience,is_active,send_as_notification,created_at,updated_at,created_by,updated_by"
    )
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      return NextResponse.json(
        { error: "Notifications table is missing. Apply the latest migrations." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Unable to update notification." },
      { status: 500 }
    );
  }

  return NextResponse.json(data as DashboardAnnouncementRecord);
}
