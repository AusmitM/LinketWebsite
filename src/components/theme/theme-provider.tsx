"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type ThemeName =
  | "light"
  | "dark"
  | "midnight"
  | "forest"
  | "gilded"
  | "silver"
  | "autumn"
  | "honey";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = "linket:theme";
const DARK_THEMES = new Set<ThemeName>(["dark", "midnight", "gilded", "forest"]);

function applyThemeClass(t: ThemeName, scopeEl?: Element | null) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const scoped = (scopeEl as Element | null) || document.body;
  const targets = scopeEl
    ? scoped
      ? [scoped]
      : []
    : Array.from(new Set([root, scoped].filter((node): node is Element => Boolean(node))));

  for (const target of targets) {
    const cl = target.classList;
    Array.from(cl)
      .filter((x) => x.startsWith("theme-"))
      .forEach((x) => cl.remove(x));
    cl.add(`theme-${t}`);
    if (DARK_THEMES.has(t)) cl.add("dark");
    else cl.remove("dark");
  }

  if (!scopeEl && root && !targets.includes(root)) {
    root.classList.toggle("dark", DARK_THEMES.has(t));
  }
}

export function ThemeProvider({
  children,
  initial,
  scopeSelector,
  storageKey,
}: {
  children: ReactNode;
  initial?: ThemeName;
  scopeSelector?: string;
  storageKey?: string | null;
}) {
  const [theme, setThemeState] = useState<ThemeName>(initial || "light");
  const storage = storageKey ?? STORAGE_KEY;
  const persist = storageKey !== null;

  useEffect(() => {
    const saved = persist ? ((localStorage.getItem(storage) as ThemeName | null) || initial || "light") : (initial || "light");
    setThemeState(saved);
    const scope = scopeSelector ? document.querySelector(scopeSelector) : undefined;
    applyThemeClass(saved, scope ?? undefined);
  }, [initial, scopeSelector, storage, persist]);

  const setTheme = useCallback(
    (t: ThemeName) => {
      setThemeState(t);
      if (persist && typeof localStorage !== "undefined") localStorage.setItem(storage, t);
      const scope = scopeSelector ? (typeof document !== "undefined" ? document.querySelector(scopeSelector) : null) : undefined;
      applyThemeClass(t, scope ?? undefined);
    },
    [scopeSelector, storage, persist]
  );

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function useThemeOptional(): { theme: ThemeName; setTheme: (t: ThemeName) => void } {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return { theme: "light", setTheme: () => {} };
}

export default ThemeProvider;


