export function buildAvatarPublicUrl(path: string | null | undefined, version?: string | number | null): string | null {
  if (!path) return null;
  let url = path;
  if (!/^https?:\/\//i.test(path)) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!base) return path;
    const trimmed = path.replace(/^\//, "");
    url = `${base}/storage/v1/object/public/avatars/${trimmed}`;
  }
  if (version === undefined || version === null) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(String(version))}`;
}
