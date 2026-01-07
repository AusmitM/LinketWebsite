import { appendVersion, isHttpUrl } from "@/lib/avatar-utils";

export function extractProfileHeaderPathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (base && !parsed.origin.startsWith(base)) return null;
    const marker = "/storage/v1/object/public/profile-headers/";
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    return parsed.pathname.slice(index + marker.length);
  } catch {
    return null;
  }
}

export function normalizeProfileHeaderPath(
  path: string | null | undefined
): string | null {
  if (!path) return null;
  if (isHttpUrl(path)) return extractProfileHeaderPathFromUrl(path);
  return path.replace(/^\//, "");
}

export function buildProfileHeaderPublicUrl(
  path: string | null | undefined,
  version?: string | number | null
): string | null {
  if (!path) return null;
  if (!isHttpUrl(path)) return null;
  return appendVersion(path, version);
}
