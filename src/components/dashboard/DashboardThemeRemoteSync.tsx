"use client";

import { useEffect, useRef } from "react";

import { coerceThemeName, type ThemeName } from "@/lib/themes";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";

const THEMES: ThemeName[] = [
  "light",
  "dark",
  "midnight",
  "dream",
  "forest",
  "gilded",
  "rose",
  "autumn",
  "honey",
  "burnt-orange",
  "maroon",
];

const PENDING_THEME_KEY = "linket:dashboard-theme:pending";
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const THEME_SYNC_INTERVAL_MS = 120_000;

type PendingThemePayload = {
  theme: ThemeName;
  at: number;
};

function readPendingTheme(): PendingThemePayload | null {
  if (typeof localStorage === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_THEME_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingThemePayload;
    if (!parsed || typeof parsed.theme !== "string" || typeof parsed.at !== "number") {
      try {
        localStorage.removeItem(PENDING_THEME_KEY);
      } catch {
        // Ignore storage failures (private browsing / restricted storage).
      }
      return null;
    }
    const age = Date.now() - parsed.at;
    if (age > PENDING_TTL_MS) {
      try {
        localStorage.removeItem(PENDING_THEME_KEY);
      } catch {
        // Ignore storage failures (private browsing / restricted storage).
      }
      return null;
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(PENDING_THEME_KEY);
    } catch {
      // Ignore storage failures (private browsing / restricted storage).
    }
    return null;
  }
}

function clearPendingTheme() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PENDING_THEME_KEY);
  } catch {
    // Ignore storage failures (private browsing / restricted storage).
  }
}

function coerceTheme(value: unknown): ThemeName | null {
  if (typeof value !== "string") return null;
  const normalized = coerceThemeName(value);
  return normalized && (THEMES as string[]).includes(normalized)
    ? normalized
    : null;
}

type ProfileThemeRecord = {
  id: string;
  name: string;
  handle: string;
  headline?: string | null;
  theme?: string | null;
  is_active?: boolean | null;
  links?: Array<{
    id?: string;
    title?: string | null;
    url?: string | null;
    is_active?: boolean | null;
    is_override?: boolean | null;
  }>;
};

async function fetchThemeProfiles(userId: string, signal: AbortSignal) {
  const res = await fetch(
    `/api/linket-profiles?userId=${encodeURIComponent(userId)}`,
    { cache: "no-store", signal }
  );
  if (!res.ok) throw new Error("Unable to load profiles.");
  return (await res.json()) as ProfileThemeRecord[];
}

function pickActiveProfile(profiles: ProfileThemeRecord[]) {
  if (!profiles.length) return null;
  return profiles.find((profile) => profile.is_active) ?? profiles[0];
}

async function fetchActiveProfileTheme(userId: string, signal: AbortSignal) {
  const profiles = await fetchThemeProfiles(userId, signal);
  const active = pickActiveProfile(profiles);
  return active ? coerceTheme(active.theme) : null;
}

async function persistPendingTheme(
  userId: string,
  nextTheme: ThemeName,
  signal: AbortSignal
) {
  const profiles = await fetchThemeProfiles(userId, signal);
  const active = pickActiveProfile(profiles);
  if (!active) return false;

  const payload = {
    id: active.id,
    name: active.name,
    handle: active.handle,
    headline: active.headline ?? "",
    theme: nextTheme,
    links: (active.links ?? [])
      .filter((link) => Boolean(link.title) && Boolean(link.url))
      .map((link) => ({
        id: link.id,
        title: link.title as string,
        url: link.url as string,
        isActive: Boolean(link.is_active),
        isOverride: Boolean(link.is_override),
      })),
    active: active.is_active ?? true,
  };

  const saveRes = await fetch("/api/linket-profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, profile: payload }),
    signal,
  });
  if (!saveRes.ok) {
    const info = await saveRes.json().catch(() => ({}));
    throw new Error(info?.error || "Unable to update theme.");
  }
  return true;
}

export default function DashboardThemeRemoteSync() {
  const { theme, setTheme, hasProvider } = useThemeOptional();
  const user = useDashboardUser();
  const abortRef = useRef<AbortController | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!hasProvider || !userId) return;
    let active = true;

    const syncTheme = async () => {
      if (!active) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const pending = readPendingTheme();
        const nextTheme = await fetchActiveProfileTheme(
          userId,
          controller.signal
        );
        if (!active) return;
        if (pending?.theme) {
          if (nextTheme === pending.theme) {
            clearPendingTheme();
          } else {
            try {
              const saved = await persistPendingTheme(
                userId,
                pending.theme,
                controller.signal
              );
              if (!active) return;
              if (saved) {
                clearPendingTheme();
                if (theme !== pending.theme) {
                  setTheme(pending.theme);
                }
              }
            } catch (persistError) {
              if (
                persistError instanceof DOMException &&
                persistError.name === "AbortError"
              ) {
                return;
              }
              console.warn("Theme persistence retry failed.");
            }
            return;
          }
        }
        if (nextTheme && nextTheme !== theme) {
          setTheme(nextTheme);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("Theme sync failed.");
      }
    };

    void syncTheme();

    const handleFocus = () => {
      void syncTheme();
    };
    const handleVisibility = () => {
      if (!document.hidden) {
        void syncTheme();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void syncTheme();
    }, THEME_SYNC_INTERVAL_MS);

    return () => {
      active = false;
      abortRef.current?.abort();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [hasProvider, setTheme, theme, userId]);

  return null;
}
