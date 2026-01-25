"server-only";

import { appendVersion, isHttpUrl } from "@/lib/avatar-utils";
import {
  extractProfileLogoPathFromUrl,
  normalizeProfileLogoPath,
} from "@/lib/profile-logo-utils";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

export async function getSignedProfileLogoUrl(
  path: string | null | undefined,
  version?: string | number | null,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!path) return null;
  if (isHttpUrl(path)) {
    const extracted = extractProfileLogoPathFromUrl(path);
    if (!extracted) return appendVersion(path, version);
    const { data, error } = await supabaseAdmin
      .storage
      .from("profile-logos")
      .createSignedUrl(extracted, expiresInSeconds);
    if (error || !data?.signedUrl) return null;
    return appendVersion(data.signedUrl, version);
  }
  if (!isSupabaseAdminAvailable) return null;
  const normalized = normalizeProfileLogoPath(path);
  if (!normalized) return null;
  const { data, error } = await supabaseAdmin
    .storage
    .from("profile-logos")
    .createSignedUrl(normalized, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return appendVersion(data.signedUrl, version);
}
