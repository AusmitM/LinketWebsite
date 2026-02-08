"use client";

const STORAGE_KEY = "linket:upload-original-filenames:v1";
const MAX_ENTRIES = 100;

const ASSET_PATH_MARKERS = [
  "/storage/v1/object/public/avatars/",
  "/storage/v1/object/sign/avatars/",
  "/storage/v1/object/public/profile-headers/",
  "/storage/v1/object/sign/profile-headers/",
  "/storage/v1/object/public/profile-logos/",
  "/storage/v1/object/sign/profile-logos/",
] as const;

type FilenameMap = Record<string, string>;

function readMap(): FilenameMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FilenameMap;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeMap(value: FilenameMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage errors in restricted/private mode.
  }
}

function trimMap(value: FilenameMap) {
  const entries = Object.entries(value);
  if (entries.length <= MAX_ENTRIES) return value;
  const next = Object.fromEntries(entries.slice(entries.length - MAX_ENTRIES));
  return next;
}

function extractPathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || "";
    for (const marker of ASSET_PATH_MARKERS) {
      const index = pathname.indexOf(marker);
      if (index !== -1) {
        return pathname.slice(index + marker.length);
      }
    }
    return pathname.replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

function normalizeAssetKey(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  const value = pathOrUrl.trim();
  if (!value) return null;
  const fromUrl = /^https?:\/\//i.test(value)
    ? extractPathFromUrl(value)
    : value.replace(/^\/+/, "");
  if (!fromUrl) return null;
  const withoutQuery = fromUrl.split("?")[0]?.split("#")[0]?.trim() ?? "";
  return withoutQuery || null;
}

export function rememberOriginalUploadFileName(
  pathOrUrl: string | null | undefined,
  fileName: string | null | undefined
) {
  const key = normalizeAssetKey(pathOrUrl);
  const value = fileName?.trim() ?? "";
  if (!key || !value) return;
  const next = readMap();
  next[key] = value;
  writeMap(trimMap(next));
}

export function readOriginalUploadFileName(
  pathOrUrl: string | null | undefined
): string | null {
  const key = normalizeAssetKey(pathOrUrl);
  if (!key) return null;
  const value = readMap()[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function forgetOriginalUploadFileName(
  pathOrUrl: string | null | undefined
) {
  const key = normalizeAssetKey(pathOrUrl);
  if (!key) return;
  const next = readMap();
  if (!(key in next)) return;
  delete next[key];
  writeMap(next);
}
