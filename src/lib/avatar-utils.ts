export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function extractAvatarPathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (base && !parsed.origin.startsWith(base)) return null;
    const marker = "/storage/v1/object/public/avatars/";
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    return parsed.pathname.slice(index + marker.length);
  } catch {
    return null;
  }
}

export function normalizeAvatarPath(
  path: string | null | undefined
): string | null {
  if (!path) return null;
  if (isHttpUrl(path)) return extractAvatarPathFromUrl(path);
  return path.replace(/^\//, "");
}

export function appendVersion(
  url: string | null,
  version?: string | number | null
): string | null {
  if (!url) return null;
  if (version === undefined || version === null) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(String(version))}`;
}

export function buildAvatarPublicUrl(
  path: string | null | undefined,
  version?: string | number | null
): string | null {
  if (!path) return null;
  if (!isHttpUrl(path)) return null;
  return appendVersion(path, version);
}
