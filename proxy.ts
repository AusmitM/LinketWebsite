import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const CANONICAL_HOST = "linketconnect.com";

function applyCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
}

export async function proxy(req: NextRequest) {
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

  const path = url.pathname;
  const needsSupabase =
    path.startsWith("/dashboard") ||
    path.startsWith("/auth") ||
    path.startsWith("/profile") ||
    path.startsWith("/admin");

  if (!needsSupabase) {
    return NextResponse.next();
  }

  const res = NextResponse.next({ request: { headers: req.headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({ name, value, ...(options ?? {}) });
        },
        remove: (name, options) => {
          res.cookies.set({ name, value: "", ...(options ?? {}), maxAge: 0 });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const fullPath = `${url.pathname}${url.search}`;
  const requiresAuth =
    path.startsWith("/dashboard") ||
    path.startsWith("/profile") ||
    path.startsWith("/admin");

  if (requiresAuth && !session) {
    const redirectUrl = new URL("/auth", req.url);
    redirectUrl.searchParams.set("view", "signin");
    redirectUrl.searchParams.set("next", fullPath || path);
    const redirect = NextResponse.redirect(redirectUrl);
    applyCookies(res, redirect);
    return redirect;
  }

  if (path.startsWith("/dashboard/admin") && session?.user?.id) {
    const { data: adminRow, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (adminError || !adminRow) {
      const redirectUrl = new URL("/dashboard", req.url);
      const redirect = NextResponse.redirect(redirectUrl);
      applyCookies(res, redirect);
      return redirect;
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
