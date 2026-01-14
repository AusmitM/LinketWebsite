"use client";

import { useEffect, useRef, useState } from "react";
import { Hexagon, Sun, Moon, MoonStar, Trees, Sparkles, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";

type ThemeName = import("@/components/theme/theme-provider").ThemeName;

const ORDER: ThemeName[] = [
  "light",
  "dark",
  "midnight",
  "forest",
  "gilded",
  "autumn",
  "honey",
];
const ICONS: Record<ThemeName, React.ComponentType<{ className?: string }>> = {
  light: Sun,
  dark: Moon,
  midnight: MoonStar,
  forest: Trees,
  gilded: Sparkles,
  autumn: Leaf,
  honey: Hexagon,
};

const LABELS: Record<ThemeName, string> = {
  light: "Light",
  dark: "Dark",
  midnight: "Midnight",
  forest: "Forest",
  gilded: "Gilded",
  autumn: "Autumn",
  honey: "Honey",
};

const PENDING_THEME_KEY = "linket:dashboard-theme:pending";

type PendingThemePayload = {
  theme: ThemeName;
  at: number;
};

function writePendingTheme(theme: ThemeName) {
  if (typeof localStorage === "undefined") return;
  const payload: PendingThemePayload = { theme, at: Date.now() };
  localStorage.setItem(PENDING_THEME_KEY, JSON.stringify(payload));
}

function clearPendingTheme() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(PENDING_THEME_KEY);
}

export default function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, setTheme } = useThemeOptional();
  const user = useDashboardUser();
  const abortRef = useRef<AbortController | null>(null);
  const [index, setIndex] = useState(Math.max(0, ORDER.indexOf(theme)));

  useEffect(() => {
    setIndex(Math.max(0, ORDER.indexOf(theme)));
  }, [theme]);

  async function syncPublicTheme(nextTheme: ThemeName) {
    if (!user?.id) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const profilesRes = await fetch(
        `/api/linket-profiles?userId=${encodeURIComponent(user.id)}`,
        { cache: "no-store", signal: controller.signal }
      );
      if (!profilesRes.ok) {
        const info = await profilesRes.json().catch(() => ({}));
        throw new Error(info?.error || "Unable to load profile.");
      }
      const profiles = (await profilesRes.json()) as Array<{
        id: string;
        name: string;
        handle: string;
        headline?: string | null;
        is_active?: boolean | null;
        links?: Array<{ id?: string; title: string; url: string }>;
      }>;
      const activeProfile =
        profiles.find((item) => item.is_active) ?? profiles[0];
      if (!activeProfile) return;

      const payload = {
        id: activeProfile.id,
        name: activeProfile.name,
        handle: activeProfile.handle,
        headline: activeProfile.headline ?? "",
        theme: nextTheme,
        links: (activeProfile.links ?? []).map((link) => ({
          id: link.id,
          title: link.title,
          url: link.url,
        })),
        active: activeProfile.is_active ?? true,
      };

      const saveRes = await fetch("/api/linket-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, profile: payload }),
        signal: controller.signal,
      });
      if (!saveRes.ok) {
        const info = await saveRes.json().catch(() => ({}));
        throw new Error(info?.error || "Unable to update public theme.");
      }
      clearPendingTheme();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message =
        error instanceof Error ? error.message : "Unable to update public theme.";
      console.warn("Theme update failed:", message);
      clearPendingTheme();
    }
  }

  function next() {
    const nextIndex = (index + 1) % ORDER.length;
    const value = ORDER[nextIndex];
    setIndex(nextIndex);
    writePendingTheme(value);
    setTheme(value);
    void syncPublicTheme(value);
  }

  const current = ORDER[index] || ORDER[0];
  const Icon = ICONS[current];
  const label = LABELS[current];

  return (
    <Button
      variant="ghost"
      size={showLabel ? "sm" : "icon"}
      aria-label={`Theme: ${label}`}
      onClick={next}
      title={`Theme: ${label}`}
      className={showLabel ? "gap-2 px-2" : undefined}
    >
      <Icon className="h-5 w-5" />
      {showLabel ? <span className="text-xs font-medium text-muted-foreground">{label}</span> : null}
    </Button>
  );
}
