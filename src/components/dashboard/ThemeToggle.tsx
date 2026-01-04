"use client";

import { useEffect, useRef, useState } from "react";
import { Sun, Moon, MoonStar, Trees, Sparkles, Gem, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";

type ThemeName = import("@/components/theme/theme-provider").ThemeName;

const ORDER: ThemeName[] = ["light", "dark", "midnight", "forest", "gilded", "silver", "autumn"];
const ICONS: Record<ThemeName, React.ComponentType<{ className?: string }>> = {
  light: Sun,
  dark: Moon,
  midnight: MoonStar,
  forest: Trees,
  gilded: Sparkles,
  silver: Gem,
  autumn: Leaf,
};

const LABELS: Record<ThemeName, string> = {
  light: "Light",
  dark: "Dark",
  midnight: "Midnight",
  forest: "Forest",
  gilded: "Gilded",
  silver: "Silver",
  autumn: "Autumn",
};

export default function ThemeToggle() {
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
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message =
        error instanceof Error ? error.message : "Unable to update public theme.";
      console.warn("Theme update failed:", message);
    }
  }

  function next() {
    const nextIndex = (index + 1) % ORDER.length;
    const value = ORDER[nextIndex];
    setIndex(nextIndex);
    setTheme(value);
    void syncPublicTheme(value);
  }

  const current = ORDER[index] || ORDER[0];
  const Icon = ICONS[current];
  const label = LABELS[current];

  return (
    <Button variant="ghost" size="icon" aria-label={`Theme: ${label}`} onClick={next} title={`Theme: ${label}`}>
      <Icon className="h-5 w-5" />
    </Button>
  );
}
