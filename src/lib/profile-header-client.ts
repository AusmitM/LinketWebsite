"use client";

import { supabase } from "@/lib/supabase";
import { appendVersion, isHttpUrl } from "@/lib/avatar-utils";
import {
  extractProfileHeaderPathFromUrl,
  normalizeProfileHeaderPath,
} from "@/lib/profile-header-utils";

export async function getSignedProfileHeaderUrl(
  path: string | null | undefined,
  version?: string | number | null,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!path) return null;
  if (isHttpUrl(path)) {
    const extracted = extractProfileHeaderPathFromUrl(path);
    if (!extracted) return appendVersion(path, version);
    const { data, error } = await supabase
      .storage
      .from("profile-headers")
      .createSignedUrl(extracted, expiresInSeconds);
    if (error || !data?.signedUrl) return null;
    return appendVersion(data.signedUrl, version);
  }
  const normalized = normalizeProfileHeaderPath(path);
  if (!normalized) return null;
  const { data, error } = await supabase
    .storage
    .from("profile-headers")
    .createSignedUrl(normalized, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return appendVersion(data.signedUrl, version);
}
