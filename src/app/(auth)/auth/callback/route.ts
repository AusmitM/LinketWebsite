import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { recordConversionEvent } from "@/lib/server-conversion-events";

const FIRST_LOGIN_REDIRECT = "/dashboard/linkets?tour=welcome";
const RETURNING_LOGIN_REDIRECT = "/dashboard/overview";

async function resolveRedirectPath(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>
) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return RETURNING_LOGIN_REDIRECT;
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const hasOnboarded = Boolean(metadata.linket_onboarded);
  if (!hasOnboarded) {
    await recordConversionEvent({
      eventId: "signup_start",
      userId: user.id,
      eventSource: "server",
      meta: { source: "auth_callback_inferred" },
    });
    await supabase.auth.updateUser({
      data: { ...metadata, linket_onboarded: true },
    });
    await recordConversionEvent({
      eventId: "signup_complete",
      userId: user.id,
      eventSource: "server",
      meta: { source: "auth_callback" },
    });
    return FIRST_LOGIN_REDIRECT;
  }
  return RETURNING_LOGIN_REDIRECT;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabase = await createServerSupabase();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      url.pathname = "/auth";
      url.searchParams.set("error", "oauth_callback_failed");
      url.searchParams.set("message", error.message);
      return NextResponse.redirect(url);
    }
  } else {
    await supabase.auth.getSession();
  }

  const redirectPath = await resolveRedirectPath(supabase);
  const redirectUrl = new URL(redirectPath, url.origin);
  return NextResponse.redirect(redirectUrl);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { event, session } = await request.json();

  if (event === "SIGNED_OUT") {
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  }

  if (event === "SIGNED_IN" && session) {
    const { error } = await supabase.auth.setSession(session);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const redirectTo = await resolveRedirectPath(supabase);
  return NextResponse.json({ ok: true, redirectTo });
}
