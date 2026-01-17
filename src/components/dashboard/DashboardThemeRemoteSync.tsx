"use client";

import { useCallback, useEffect, useRef } from "react";

import type { ThemeName } from "@/components/theme/theme-provider";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";

const THEMES: ThemeName[] = [
  "light",
  "dark",
  "midnight",
  "forest",
  "gilded",
  "autumn",
  "honey",
];

const PENDING_THEME_KEY = "linket:dashboard-theme:pending";
const PENDING_TTL_MS = 8000;

type PendingThemePayload = {
  theme: ThemeName;
  at: number;
};

function readPendingTheme(): PendingThemePayload | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(PENDING_THEME_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingThemePayload;
    if (!parsed || typeof parsed.theme !== "string" || typeof parsed.at !== "number") {
      localStorage.removeItem(PENDING_THEME_KEY);
      return null;
    }
    const age = Date.now() - parsed.at;
    if (age > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_THEME_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(PENDING_THEME_KEY);
    return null;
  }
}

function clearPendingTheme() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(PENDING_THEME_KEY);
}

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
  const { theme, setTheme, hasProvider } = useThemeOptional();
  const user = useDashboardUser();
  const abortRef = useRef<AbortController | null>(null);

  const syncTheme = useCallback(async () => {
    if (!hasProvider || !user?.id) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const pending = readPendingTheme();
      const nextTheme = await fetchActiveProfileTheme(user.id, controller.signal);
      if (pending?.theme) {
        if (nextTheme === pending.theme) {
          clearPendingTheme();
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
  }, [hasProvider, setTheme, theme, user?.id]);

  useEffect(() => {
    if (!hasProvider || !user?.id) return;
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
