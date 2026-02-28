import "server-only";

import type { NextRequest } from "next/server";

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/csrf";
import { getConfiguredSiteOrigin } from "@/lib/site-url";

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isTrustedRequestOrigin(request: NextRequest) {
  const requestOrigin = normalizeOrigin(request.headers.get("origin"));
  const runtimeOrigin = normalizeOrigin(request.nextUrl.origin);
  const configuredOrigin = normalizeOrigin(getConfiguredSiteOrigin());
  const method = request.method.toUpperCase();

  const allowedOrigins = new Set(
    [runtimeOrigin, configuredOrigin].filter(
      (value): value is string => typeof value === "string" && value.length > 0
    )
  );

  if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    return true;
  }

  const refererOrigin = normalizeOrigin(request.headers.get("referer"));
  if (refererOrigin && allowedOrigins.has(refererOrigin)) {
    return true;
  }

  // Some browser form POST navigations omit Origin/Referer depending on policy.
  // Allow explicit same-origin/same-site fetch-site metadata in that case.
  if (!requestOrigin && !refererOrigin) {
    const fetchSite = (request.headers.get("sec-fetch-site") ?? "").trim();
    if (fetchSite === "same-origin" || fetchSite === "same-site") {
      return true;
    }
    if ((method === "GET" || method === "HEAD") && fetchSite === "none") {
      return true;
    }
  }

  const csrfHeader = request.headers.get(CSRF_HEADER_NAME)?.trim() ?? "";
  const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value?.trim() ?? "";
  if (csrfHeader && csrfCookie && csrfHeader === csrfCookie) {
    return true;
  }

  return false;
}
