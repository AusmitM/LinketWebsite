import type { ThemeName } from "@/lib/themes";

const PENDING_THEME_KEY = "linket:dashboard-theme:pending";
const PENDING_TTL_MS = 8000;

type PendingThemePayload = {
  theme: ThemeName;
  at: number;
};

export function writePendingDashboardTheme(theme: ThemeName) {
  if (typeof localStorage === "undefined") return;
  const payload: PendingThemePayload = { theme, at: Date.now() };
  try {
    localStorage.setItem(PENDING_THEME_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private browsing / restricted storage).
  }
}

export function readPendingDashboardTheme(): PendingThemePayload | null {
  if (typeof localStorage === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_THEME_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingThemePayload;
    if (!parsed || typeof parsed.theme !== "string" || typeof parsed.at !== "number") {
      clearPendingDashboardTheme();
      return null;
    }
    const age = Date.now() - parsed.at;
    if (age > PENDING_TTL_MS) {
      clearPendingDashboardTheme();
      return null;
    }
    return parsed;
  } catch {
    clearPendingDashboardTheme();
    return null;
  }
}

export function clearPendingDashboardTheme() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PENDING_THEME_KEY);
  } catch {
    // Ignore storage failures (private browsing / restricted storage).
  }
}
