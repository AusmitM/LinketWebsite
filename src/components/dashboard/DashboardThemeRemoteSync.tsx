"use client";

import { useEffect, useRef } from "react";

import { coerceThemeName, type ThemeName } from "@/lib/themes";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import {
  clearPendingDashboardTheme,
  readPendingDashboardTheme,
} from "@/lib/dashboard-theme-pending";

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

const THEME_SYNC_INTERVAL_MS = 120_000;

function coerceTheme(value: unknown): ThemeName | null {
  if (typeof value !== "string") return null;
  const normalized = coerceThemeName(value);
  return normalized && (THEMES as string[]).includes(normalized)
    ? normalized
    : null;
}

async function fetchActiveProfileTheme(userId: string, signal: AbortSignal) {
  const res = await fetch(
    `/api/linket-profiles?userId=${encodeURIComponent(userId)}`,
    { cache: "no-store", signal }
  );
  if (!res.ok) return null;
  const profiles = (await res.json()) as Array<{
    id: string;
    theme?: string | null;
    is_active?: boolean | null;
  }>;
  if (!profiles.length) return null;
  const active = profiles.find((profile) => profile.is_active) ?? profiles[0];
  return coerceTheme(active?.theme);
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
        const nextTheme = await fetchActiveProfileTheme(
          userId,
          controller.signal
        );
        if (!active) return;
        const pending = readPendingDashboardTheme();
        if (pending?.theme) {
          if (nextTheme === pending.theme) {
            clearPendingDashboardTheme();
          } else if (nextTheme && nextTheme !== pending.theme) {
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
