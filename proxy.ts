import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";
import { matchPrivilegedRouteId } from "@/lib/api-authorization-policy";
import { isCrossOriginRequest, resolveCorsHeaders } from "@/lib/cors";
import {
  buildRateLimitHeaders,
  consumeRateLimit,
  getClientIp,
  getRateLimitConfig,
  resolveApiRateLimitProfile,
} from "@/lib/rate-limit";
import { hasAmbiguousRequestBodyHeaders } from "@/lib/security";
import {
  readBearerTokenFromHeaders,
  verifySupabaseAccessToken,
} from "@/lib/supabase/auth-token";

const CANONICAL_HOST = "linketconnect.com";

function applyCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
}

function applyHeaders(
  response: NextResponse,
  headers: Record<string, string> | null | undefined
) {
  if (!headers) {
    return;
  }

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
}

function readRequestedCorsHeaders(request: NextRequest) {
  const requestedHeaders =
    request.headers.get("access-control-request-headers") ?? "";
  return requestedHeaders
    .split(",")
    .map((header) => header.trim())
    .filter(Boolean);
}

function resolveApiCorsHeaders(request: NextRequest) {
  const requestedMethod =
    request.headers.get("access-control-request-method")?.trim().toUpperCase() ??
    request.method.toUpperCase();

  return resolveCorsHeaders(request.headers.get("origin"), {
    allowHeaders: readRequestedCorsHeaders(request),
    allowMethods: ["OPTIONS", requestedMethod],
  });
}

async function resolveApiUserId(request: NextRequest) {
  const bearerToken = readBearerTokenFromHeaders(request.headers);
  if (bearerToken) {
    const verified = await verifySupabaseAccessToken(bearerToken);
    return {
      invalidToken: !verified.user,
      userId: verified.user?.id ?? null,
    };
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set() {},
        remove() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    invalidToken: false,
    userId: user?.id ?? null,
  };
}

async function handleApiRequest(request: NextRequest) {
  const routeId = matchPrivilegedRouteId(
    request.method,
    request.nextUrl.pathname
  );
  const origin = request.headers.get("origin");
  const crossOrigin = isCrossOriginRequest(origin, request.nextUrl.origin);
  const corsHeaders = resolveApiCorsHeaders(request);

  if (request.method === "OPTIONS" && origin) {
    if (crossOrigin && !corsHeaders) {
      console.warn("Blocked API preflight from disallowed origin", {
        origin,
        pathname: request.nextUrl.pathname,
      });
      return new NextResponse(null, {
        headers: { Vary: "Origin" },
        status: 403,
      });
    }

    return new NextResponse(null, {
      headers: corsHeaders ?? { Vary: "Origin" },
      status: 204,
    });
  }

  if (crossOrigin && origin && !corsHeaders) {
    console.warn("Blocked API request from disallowed origin", {
      origin,
      pathname: request.nextUrl.pathname,
    });
    return NextResponse.json(
      { error: "Origin not allowed." },
      {
        headers: { Vary: "Origin" },
        status: 403,
      }
    );
  }

  const rateLimitConfig = getRateLimitConfig();
  if (!rateLimitConfig.enabled) {
    const response = NextResponse.next({ request: { headers: request.headers } });
    applyHeaders(response, corsHeaders);
    return response;
  }

  const rateLimitProfile = resolveApiRateLimitProfile({
    isPrivilegedRoute: Boolean(routeId),
    pathname: request.nextUrl.pathname,
  });
  const ipRateLimitState = await consumeRateLimit({
    identifier: getClientIp(request.headers),
    limit: rateLimitProfile.ip.limit,
    prefix: request.nextUrl.pathname,
    scope: "ip",
    windowMs: rateLimitProfile.ip.windowMs,
  });

  if (!ipRateLimitState.allowed) {
    const response = NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
    applyHeaders(response, corsHeaders);
    applyHeaders(response, buildRateLimitHeaders([ipRateLimitState]));
    console.warn("API rate limit exceeded", {
      pathname: request.nextUrl.pathname,
      scope: "ip",
    });
    return response;
  }

  const rateLimitStates = [ipRateLimitState];
  if (routeId && rateLimitProfile.user) {
    const actor = await resolveApiUserId(request);
    if (actor.invalidToken) {
      const response = NextResponse.json(
        { error: "Invalid bearer token." },
        { status: 401 }
      );
      applyHeaders(response, corsHeaders);
      applyHeaders(response, buildRateLimitHeaders(rateLimitStates));
      return response;
    }

    if (actor.userId) {
      const userRateLimitState = await consumeRateLimit({
        identifier: actor.userId,
        limit: rateLimitProfile.user.limit,
        prefix: request.nextUrl.pathname,
        scope: "user",
        windowMs: rateLimitProfile.user.windowMs,
      });
      rateLimitStates.push(userRateLimitState);

      if (!userRateLimitState.allowed) {
        const response = NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
        applyHeaders(response, corsHeaders);
        applyHeaders(response, buildRateLimitHeaders(rateLimitStates));
        console.warn("API rate limit exceeded", {
          pathname: request.nextUrl.pathname,
          scope: "user",
          userId: actor.userId,
        });
        return response;
      }
    }
  }

  const response = NextResponse.next({ request: { headers: request.headers } });
  applyHeaders(response, corsHeaders);
  applyHeaders(response, buildRateLimitHeaders(rateLimitStates));
  return response;
}

export async function proxy(req: NextRequest) {
  const url = req.nextUrl;

  if (hasAmbiguousRequestBodyHeaders(req.headers)) {
    return NextResponse.json(
      { error: "Ambiguous request body framing is not allowed." },
      { status: 400 }
    );
  }

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
  if (path.startsWith("/api/")) {
    return handleApiRequest(req);
  }

  const needsSupabase =
    path.startsWith("/dashboard") ||
    path.startsWith("/auth") ||
    path.startsWith("/profile") ||
    path.startsWith("/admin");

  if (!needsSupabase) {
    return NextResponse.next();
  }

  const res = NextResponse.next({ request: { headers: req.headers } });
  if (!req.cookies.get(CSRF_COOKIE_NAME)?.value) {
    res.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: crypto.randomUUID(),
      sameSite: "lax",
      secure: url.protocol === "https:",
      path: "/",
    });
  }

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
    const { data: adminRows, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .limit(1);

    if (adminError || !adminRows || adminRows.length === 0) {
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
