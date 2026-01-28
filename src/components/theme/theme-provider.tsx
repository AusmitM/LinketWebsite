"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

export type ThemeName =
  | "light"
  | "dark"
  | "midnight"
  | "dream"
  | "forest"
  | "gilded"
  | "rose"
  | "autumn"
  | "honey"
  | "burnt-orange"
  | "maroon";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = "linket:theme";
const THEME_EVENT = "linket:theme-change";
const DARK_THEMES = new Set<ThemeName>([
  "dark",
  "midnight",
  "gilded",
  "forest",
  "burnt-orange",
  "maroon",
]);

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
  const storage = storageKey ?? STORAGE_KEY;
  const persist = storageKey !== null;

  const getSnapshot = useCallback(() => {
    if (!persist) return initial || "light";
    if (typeof window === "undefined") return initial || "light";
    return (
      (localStorage.getItem(storage) as ThemeName | null) ||
      initial ||
      "light"
    );
  }, [initial, persist, storage]);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === "undefined") return () => {};
      const handler = () => callback();
      if (persist) {
        window.addEventListener("storage", handler);
      }
      window.addEventListener(THEME_EVENT, handler);
      return () => {
        if (persist) {
          window.removeEventListener("storage", handler);
        }
        window.removeEventListener(THEME_EVENT, handler);
      };
    },
    [persist]
  );

  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => initial || "light"
  );

  useEffect(() => {
    const scope = scopeSelector ? document.querySelector(scopeSelector) : undefined;
    applyThemeClass(theme, scope ?? undefined);
  }, [theme, scopeSelector]);

  const setTheme = useCallback(
    (t: ThemeName) => {
      if (persist && typeof localStorage !== "undefined") localStorage.setItem(storage, t);
      const scope = scopeSelector ? (typeof document !== "undefined" ? document.querySelector(scopeSelector) : null) : undefined;
      applyThemeClass(t, scope ?? undefined);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(THEME_EVENT));
      }
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

export function useThemeOptional(): { theme: ThemeName; setTheme: (t: ThemeName) => void; hasProvider: boolean } {
  const ctx = useContext(ThemeContext);
  if (ctx) return { ...ctx, hasProvider: true };
  return { theme: "light", setTheme: () => {}, hasProvider: false };
}

export default ThemeProvider;
