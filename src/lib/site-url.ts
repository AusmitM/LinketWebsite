const DEFAULT_SITE_ORIGIN = "http://localhost:3000";

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function getConfiguredSiteOrigin() {
  return normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? DEFAULT_SITE_ORIGIN;
}

export function getSiteOrigin() {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return DEFAULT_SITE_ORIGIN;
}

export function toAbsoluteSiteUrl(path = "/", origin = getConfiguredSiteOrigin()) {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${origin.replace(/\/$/, "")}${safePath}`;
}
