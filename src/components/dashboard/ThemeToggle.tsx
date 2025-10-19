"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, MoonStar, Trees, Sparkles, Gem, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeOptional } from "@/components/theme/theme-provider";

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
  const [index, setIndex] = useState(Math.max(0, ORDER.indexOf(theme)));

  useEffect(() => {
    setIndex(Math.max(0, ORDER.indexOf(theme)));
  }, [theme]);

  function next() {
    const nextIndex = (index + 1) % ORDER.length;
    const value = ORDER[nextIndex];
    setIndex(nextIndex);
    setTheme(value);
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
