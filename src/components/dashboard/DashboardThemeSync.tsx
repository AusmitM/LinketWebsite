"use client";

import { useEffect, useRef } from "react";

import type { ThemeName } from "@/components/theme/theme-provider";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { isDarkTheme } from "@/lib/themes";

const THEME_PREFIX = "theme-";

type Snapshot = {
  bodyClasses: string[];
  rootClasses: string[];
  bodyDark: boolean;
  rootDark: boolean;
};

function collectThemeClasses(target: Element | null) {
  if (!target) return [] as string[];
  return Array.from(target.classList).filter((name) => name.startsWith(THEME_PREFIX));
}

function restoreTheme(target: Element | null, classes: string[], isDark: boolean) {
  if (!target) return;
  const existing = collectThemeClasses(target);
  for (const name of existing) target.classList.remove(name);
  for (const name of classes) target.classList.add(name);
  target.classList.toggle("dark", isDark);
}

function applyTheme(target: Element | null, theme: ThemeName) {
  if (!target) return;
  const existing = collectThemeClasses(target);
  for (const name of existing) target.classList.remove(name);
  target.classList.add(`${THEME_PREFIX}${theme}`);
  target.classList.toggle("dark", isDarkTheme(theme));
}

export default function DashboardThemeSync() {
  const { theme, hasProvider } = useThemeOptional();
  const snapshot = useRef<Snapshot | null>(null);

  useEffect(() => {
    if (!hasProvider) return;
    if (typeof document === "undefined") return;
    const body = document.body;
    const root = document.documentElement;

    if (!snapshot.current) {
      snapshot.current = {
        bodyClasses: collectThemeClasses(body),
        rootClasses: collectThemeClasses(root),
        bodyDark: body.classList.contains("dark"),
        rootDark: root.classList.contains("dark"),
      };
    }

    return () => {
      if (!snapshot.current) return;
      const { bodyClasses, rootClasses, bodyDark, rootDark } = snapshot.current;
      restoreTheme(document.body, bodyClasses, bodyDark);
      restoreTheme(document.documentElement, rootClasses, rootDark);
    };
  }, [hasProvider]);

  useEffect(() => {
    if (!hasProvider) return;
    if (typeof document === "undefined") return;
    applyTheme(document.body, theme);
    applyTheme(document.documentElement, theme);
  }, [hasProvider, theme]);

  return null;
}
