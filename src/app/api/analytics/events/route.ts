import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServerSupabaseReadonly } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import { limitRequest } from "@/lib/rate-limit";

type AnalyticsEventBody = {
  id?: string;
  meta?: Record<string, unknown> | null;
  path?: string | null;
  href?: string | null;
  referrer?: string | null;
  timestamp?: string | null;
};

function sanitizeString(value: unknown, max = 1024) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizeMeta(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isIgnorableInsertError(message: string) {
  const lowered = message.toLowerCase();
  return lowered.includes("relation \"conversion_events\" does not exist");
}

async function resolveUserId() {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function readHandleFromMeta(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const handle = (value as Record<string, unknown>).handle;
  if (typeof handle !== "string") return null;
  const normalized = handle.trim().toLowerCase();
  return normalized || null;
}

async function resolveAttributedUserId(
  currentUserId: string | null,
  meta: unknown
) {
  if (currentUserId) return currentUserId;
  if (!isSupabaseAdminAvailable) return null;
  const handle = readHandleFromMeta(meta);
  if (!handle) return null;
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("user_id")
    .eq("handle", handle)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return null;
  return (data?.user_id as string | null) ?? null;
}

export async function POST(request: NextRequest) {
  try {
    if (await limitRequest(request, "analytics-events", 120, 60_000)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as AnalyticsEventBody;
    const eventId = sanitizeString(body.id, 120);
    if (!eventId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const resolvedUserId = await resolveAttributedUserId(
      await resolveUserId(),
      body.meta
    );

    const payload = {
      event_id: eventId,
      event_source: "web",
      user_id: resolvedUserId,
      path: sanitizeString(body.path, 512) || null,
      href: sanitizeString(body.href, 1024) || null,
      referrer: sanitizeString(body.referrer, 1024) || null,
      timestamp: normalizeTimestamp(body.timestamp),
      meta: normalizeMeta(body.meta),
    };

    if (isSupabaseAdminAvailable) {
      const { error } = await supabaseAdmin
        .from("conversion_events")
        .insert(payload);
      if (error) {
        if (!isIgnorableInsertError(error.message)) {
          throw new Error(error.message);
        }
      }
    } else {
      const supabase = await createServerSupabaseReadonly();
      const { error } = await supabase
        .from("conversion_events")
        .insert(payload);
      if (error) {
        if (!isIgnorableInsertError(error.message)) {
          throw new Error(error.message);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to record analytics event",
      },
      { status: 500 }
    );
  }
}
