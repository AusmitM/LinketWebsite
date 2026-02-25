import "server-only";

import type { NextRequest } from "next/server";

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
  if (!requestOrigin) return true;

  const runtimeOrigin = normalizeOrigin(request.nextUrl.origin);
  const configuredOrigin = normalizeOrigin(getConfiguredSiteOrigin());

  const allowedOrigins = new Set(
    [runtimeOrigin, configuredOrigin].filter(
      (value): value is string => typeof value === "string" && value.length > 0
    )
  );

  return allowedOrigins.has(requestOrigin);
}
