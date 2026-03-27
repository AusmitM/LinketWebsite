"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import {
  coerceThemeName,
  isDarkTheme,
  type ThemeName,
} from "@/lib/themes";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = "linket:theme";
const THEME_EVENT = "linket:theme-change";
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
    if (isDarkTheme(t)) cl.add("dark");
    else cl.remove("dark");
  }

  if (!scopeEl && root && !targets.includes(root)) {
    root.classList.toggle("dark", isDarkTheme(t));
  }
}

export function ThemeProvider({
  children,
  initial,
  scopeSelector,
  storageKey,
  allowedThemes,
}: {
  children: ReactNode;
  initial?: ThemeName;
  scopeSelector?: string;
  storageKey?: string | null;
  allowedThemes?: readonly ThemeName[];
}) {
  const storage = storageKey ?? STORAGE_KEY;
  const persist = storageKey !== null;
  const fallbackTheme = initial || "light";

  const sanitizeTheme = useCallback(
    (value: string | ThemeName | null | undefined) => {
      const normalized = coerceThemeName(value) ?? fallbackTheme;
      if (!allowedThemes?.length) return normalized;
      return allowedThemes.includes(normalized) ? normalized : fallbackTheme;
    },
    [allowedThemes, fallbackTheme]
  );

  const getSnapshot = useCallback(() => {
    if (!persist) return sanitizeTheme(fallbackTheme);
    if (typeof window === "undefined") return sanitizeTheme(fallbackTheme);
    try {
      const stored = localStorage.getItem(storage);
      const nextTheme = sanitizeTheme(stored);
      if (stored !== nextTheme) {
        localStorage.setItem(storage, nextTheme);
      }
      return nextTheme;
    } catch {
      return sanitizeTheme(fallbackTheme);
    }
  }, [fallbackTheme, persist, sanitizeTheme, storage]);

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
    () => sanitizeTheme(fallbackTheme)
  );

  useEffect(() => {
    const scope = scopeSelector ? document.querySelector(scopeSelector) : undefined;
    applyThemeClass(theme, scope ?? undefined);
  }, [theme, scopeSelector]);

  const setTheme = useCallback(
    (t: ThemeName) => {
      const nextTheme = sanitizeTheme(t);
      if (persist && typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(storage, nextTheme);
        } catch {
          // Ignore storage failures (private browsing / restricted storage).
        }
      }
      const scope = scopeSelector
        ? typeof document !== "undefined"
          ? document.querySelector(scopeSelector)
          : null
        : undefined;
      applyThemeClass(nextTheme, scope ?? undefined);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(THEME_EVENT));
      }
    },
    [persist, sanitizeTheme, scopeSelector, storage]
  );

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeOptional(): { theme: ThemeName; setTheme: (t: ThemeName) => void; hasProvider: boolean } {
  const ctx = useContext(ThemeContext);
  if (ctx) return { ...ctx, hasProvider: true };
  return { theme: "light", setTheme: () => {}, hasProvider: false };
}
