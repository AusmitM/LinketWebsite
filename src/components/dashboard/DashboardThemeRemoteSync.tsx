"use client";

import { useCallback, useEffect, useRef } from "react";

import type { ThemeName } from "@/components/theme/theme-provider";
import { useTheme } from "@/components/theme/theme-provider";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";

const THEMES: ThemeName[] = [
  "light",
  "dark",
  "midnight",
  "forest",
  "gilded",
  "silver",
  "autumn",
  "honey",
];

function coerceTheme(value: unknown): ThemeName | null {
  if (typeof value !== "string") return null;
  const lowered = value.toLowerCase();
  return (THEMES as string[]).includes(lowered) ? (lowered as ThemeName) : null;
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
  const { theme, setTheme } = useTheme();
  const user = useDashboardUser();
  const abortRef = useRef<AbortController | null>(null);

  const syncTheme = useCallback(async () => {
    if (!user?.id) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const nextTheme = await fetchActiveProfileTheme(user.id, controller.signal);
      if (nextTheme && nextTheme !== theme) {
        setTheme(nextTheme);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.warn("Theme sync failed.");
    }
  }, [setTheme, theme, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
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
      void syncTheme();
    }, 15000);

    return () => {
      abortRef.current?.abort();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [syncTheme, user?.id]);

  return null;
}
