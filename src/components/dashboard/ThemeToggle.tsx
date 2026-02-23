"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Hexagon,
  Rose,
  Shield,
  Sun,
  Moon,
  MoonStar,
  Cloud,
  Trees,
  Sparkles,
  Leaf,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeOptional } from "@/components/theme/theme-provider";
import type { ThemeName } from "@/lib/themes";
import { FREE_PLAN_ALLOWED_THEMES } from "@/lib/billing/feature-limits";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";

const ORDER: ThemeName[] = [
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

const FREE_ORDER: ThemeName[] = [...FREE_PLAN_ALLOWED_THEMES];
const FREE_THEME_SET = new Set<ThemeName>(FREE_ORDER);

const BullHead = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4 7c2-3 6-3 8 0" />
    <path d="M20 7c-2-3-6-3-8 0" />
    <path d="M6 9c0 5 2.5 8 6 8s6-3 6-8" />
    <path d="M9 12h.01" />
    <path d="M15 12h.01" />
  </svg>
);
const ICONS: Record<ThemeName, React.ComponentType<{ className?: string }>> = {
  light: Sun,
  dark: Moon,
  midnight: MoonStar,
  dream: Cloud,
  forest: Trees,
  gilded: Sparkles,
  rose: Rose,
  autumn: Leaf,
  honey: Hexagon,
  "burnt-orange": BullHead,
  maroon: Shield,
};

const LABELS: Record<ThemeName, string> = {
  light: "Light",
  dark: "Dark",
  midnight: "Midnight",
  dream: "Dream",
  forest: "Forest",
  gilded: "Gilded",
  rose: "Rose",
  autumn: "Autumn",
  honey: "Honey",
  "burnt-orange": "Hook 'Em",
  maroon: "Aggie",
};

const PENDING_THEME_KEY = "linket:dashboard-theme:pending";

type PendingThemePayload = {
  theme: ThemeName;
  at: number;
};

function writePendingTheme(theme: ThemeName) {
  if (typeof localStorage === "undefined") return;
  const payload: PendingThemePayload = { theme, at: Date.now() };
  try {
    localStorage.setItem(PENDING_THEME_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private browsing / restricted storage).
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

export default function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, setTheme } = useThemeOptional();
  const user = useDashboardUser();
  const abortRef = useRef<AbortController | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hasPaidAccess, setHasPaidAccess] = useState<boolean | null>(null);
  const accessIsKnownFree = hasPaidAccess === false;
  const accessHasPaid = hasPaidAccess === true;
  const availableOrder = useMemo(
    () => (accessIsKnownFree ? FREE_ORDER : ORDER),
    [accessIsKnownFree]
  );
  const [index, setIndex] = useState(
    Math.max(0, availableOrder.indexOf(theme))
  );

  useEffect(() => {
    const nextIndex = availableOrder.indexOf(theme);
    setIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [availableOrder, theme]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBillingAccess() {
      if (!user?.id) {
        setHasPaidAccess(false);
        return;
      }

      try {
        const response = await fetch("/api/billing/summary", {
          cache: "no-store",
        });
        if (!active) return;
        if (!response.ok) {
          setHasPaidAccess(null);
          return;
        }
        const payload = (await response.json().catch(() => null)) as
          | { hasPaidAccess?: boolean }
          | null;
        setHasPaidAccess(Boolean(payload?.hasPaidAccess));
      } catch {
        if (active) setHasPaidAccess(null);
      }
    }

    void loadBillingAccess();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const syncPublicTheme = useCallback(async (nextTheme: ThemeName) => {
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
        links?: Array<{
          id?: string;
          title: string;
          url: string;
          is_active?: boolean | null;
          is_override?: boolean | null;
        }>;
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
          isActive: Boolean(link.is_active),
          isOverride: Boolean(link.is_override),
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
      // Keep the pending marker so background sync can retry persistence.
    }
  }, [user?.id]);

  useEffect(() => {
    if (!mounted || accessHasPaid || !accessIsKnownFree) return;
    if (FREE_THEME_SET.has(theme)) return;

    const fallbackTheme: ThemeName = "light";
    setTheme(fallbackTheme);
    writePendingTheme(fallbackTheme);
    void syncPublicTheme(fallbackTheme);
  }, [accessHasPaid, accessIsKnownFree, mounted, setTheme, syncPublicTheme, theme]);

  function next() {
    const nextIndex = (index + 1) % availableOrder.length;
    const value = availableOrder[nextIndex];
    setIndex(nextIndex);
    writePendingTheme(value);
    setTheme(value);
    void syncPublicTheme(value);
  }

  function previous() {
    const nextIndex =
      (index - 1 + availableOrder.length) % availableOrder.length;
    const value = availableOrder[nextIndex];
    setIndex(nextIndex);
    writePendingTheme(value);
    setTheme(value);
    void syncPublicTheme(value);
  }

  const current = availableOrder[index] || availableOrder[0];
  const Icon = ICONS[current];
  const label = LABELS[current];

  if (!mounted) {
    if (!showLabel) {
      return (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Theme"
          title="Theme"
          disabled
        >
          <Sun className="h-5 w-5" />
        </Button>
      );
    }
    return (
      <div className="flex w-full items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-2 py-1.5 shadow-sm backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous theme"
          className="h-8 w-8 rounded-lg"
          disabled
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground">
          <Sun className="h-4 w-4 shrink-0" />
          <span className="font-medium whitespace-nowrap">Theme</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next theme"
          className="h-8 w-8 rounded-lg"
          disabled
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (!showLabel) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Theme: ${label}`}
        onClick={next}
        title={`Theme: ${label}`}
      >
        <Icon className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="flex w-full items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-2 py-1.5 shadow-sm backdrop-blur">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={previous}
        aria-label="Previous theme"
        className="h-8 w-8 rounded-lg"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div
        aria-label={`Theme: ${label}`}
        title={`Theme: ${label}`}
        className="flex flex-1 items-center gap-2 rounded-lg px-2 text-xs"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="font-medium text-muted-foreground whitespace-nowrap">
          {label}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={next}
        aria-label="Next theme"
        className="h-8 w-8 rounded-lg"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
