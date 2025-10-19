import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CANONICAL_HOST = "linketconnect.com";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  if (
    url.hostname !== CANONICAL_HOST &&
    !url.hostname.endsWith(".vercel.app") &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    url.hostname = CANONICAL_HOST;
    return NextResponse.redirect(url, 308);
  }

  const p = url.pathname;
  const SUPABASE_COOKIES = ["sb-access-token", "sb-refresh-token", "supabase-auth-token", "sb:token"] as const;
  const hasSupabaseSession = SUPABASE_COOKIES.some((key) => req.cookies.get(key));
  const hasLegacySession = Boolean(req.cookies.get("next-auth.session-token"));
  const hasSession = hasSupabaseSession || hasLegacySession;

  const redirectToAuth = (nextPath: string) => {
    const safeNext = nextPath && nextPath.startsWith("/") ? nextPath : `/${nextPath.replace(/^\/+/, "")}`;
    const params = new URLSearchParams({ next: safeNext, view: "signin" });
    return NextResponse.redirect(new URL(`/auth?${params.toString()}`, req.url));
  };

  const fullPath = `${url.pathname}${url.search}`;

  if ((p === "/dashboard" || p.startsWith("/dashboard/")) && !hasSession)
    return redirectToAuth(fullPath || "/dashboard");

  if ((p === "/profile" || p.startsWith("/profile/")) && !hasSession)
    return redirectToAuth(fullPath || "/profile");

  if (p.startsWith("/admin") && !hasSession)
    return redirectToAuth(fullPath || "/admin");

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
