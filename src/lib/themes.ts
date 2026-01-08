export type ThemeName =
  | "light"
  | "dark"
  | "midnight"
  | "forest"
  | "gilded"
  | "silver"
  | "autumn"
  | "honey";

type Vars = Record<string, string>;

const themes: Record<ThemeName, Vars> = {
  light: {
    "--background": "#f5f7fb",
    "--foreground": "#101828",
    "--card": "#ffffff",
    "--card-foreground": "#101828",
    "--muted": "#e4e8f2",
    "--muted-foreground": "#475569",
    "--accent": "#c7d2fe",
    "--accent-foreground": "#1f1b4d",
    "--destructive": "#ef4444",
    "--border": "#d7deed",
    "--input": "#d7deed",
    "--ring": "#2563eb",
    "--avatar-border": "#f5f7fb",
  },
  dark: {
    "--background": "#121826",
    "--foreground": "#f5f7ff",
    "--card": "#1a2237",
    "--card-foreground": "#f5f7ff",
    "--muted": "#172135",
    "--muted-foreground": "#9fb0d0",
    "--accent": "#2b3c5c",
    "--accent-foreground": "#f5f7ff",
    "--destructive": "#f87171",
    "--border": "#1f2b45",
    "--input": "#1f2b45",
    "--ring": "#60a5fa",
    "--avatar-border": "#121826",
  },
  midnight: {
    "--background": "#050414",
    "--foreground": "#f4f3ff",
    "--card": "#120f2e",
    "--card-foreground": "#f4f3ff",
    "--muted": "#120f2a",
    "--muted-foreground": "#a59bff",
    "--accent": "#2a2358",
    "--accent-foreground": "#f4f3ff",
    "--destructive": "#f87171",
    "--border": "#1f1a3d",
    "--input": "#1f1a3d",
    "--ring": "#8b5cf6",
    "--avatar-border": "#050414",
  },
  forest: {
    "--background": "#0f2418",
    "--foreground": "#e9f8ef",
    "--card": "#122a1e",
    "--card-foreground": "#e9f8ef",
    "--muted": "#143426",
    "--muted-foreground": "#9dd6b7",
    "--accent": "#2f8054",
    "--accent-foreground": "#e9f8ef",
    "--destructive": "#f87171",
    "--border": "#1c3f2c",
    "--input": "#1c3f2c",
    "--ring": "#34d399",
    "--avatar-border": "#0f2418",
  },
  gilded: {
    "--background": "#080705",
    "--foreground": "#f8f3e5",
    "--card": "#14110d",
    "--card-foreground": "#f8f3e5",
    "--muted": "#1f170c",
    "--muted-foreground": "#d9c498",
    "--accent": "#b5913a",
    "--accent-foreground": "#130f05",
    "--destructive": "#fb7185",
    "--border": "#2e2514",
    "--input": "#2e2514",
    "--ring": "#f5c76d",
    "--avatar-border": "#080705",
  },
  silver: {
    "--background": "#f5f7f8",
    "--foreground": "#1a1f2c",
    "--card": "#ffffff",
    "--card-foreground": "#1a1f2c",
    "--muted": "#e8ecf2",
    "--muted-foreground": "#4b5563",
    "--accent": "#cbd5f5",
    "--accent-foreground": "#111827",
    "--destructive": "#ef4444",
    "--border": "#cbd2dd",
    "--input": "#cbd2dd",
    "--ring": "#94a3b8",
    "--avatar-border": "#f5f7f8",
  },
  autumn: {
    "--background": "#fff6ed",
    "--foreground": "#3e2213",
    "--card": "#fffaf3",
    "--card-foreground": "#3e2213",
    "--muted": "#f7e4cf",
    "--muted-foreground": "#7c4a2a",
    "--accent": "#f3b680",
    "--accent-foreground": "#3d1f10",
    "--destructive": "#ef4444",
    "--border": "#f1cfb0",
    "--input": "#f1cfb0",
    "--ring": "#d97706",
    "--avatar-border": "#fff6ed",
  },
  honey: {
    "--background": "#f7dcab",
    "--foreground": "#3f1f0c",
    "--card": "#fff2d9",
    "--card-foreground": "#3f1f0c",
    "--muted": "#f4c25a",
    "--muted-foreground": "#7c3a1a",
    "--accent": "#ebaa32",
    "--accent-foreground": "#3b1a07",
    "--destructive": "#ef4444",
    "--border": "#f4c25a",
    "--input": "#f4c25a",
    "--ring": "#df6206",
    "--avatar-border": "#df6206",
  },
};

const DARK_SET: Set<ThemeName> = new Set(["dark", "midnight", "forest", "gilded"]);

export function isDarkTheme(name: ThemeName) {
  return DARK_SET.has(name);
}

export function inlineCssForTheme(name: ThemeName | string | null | undefined) {
  const key = (name as ThemeName) && themes[(name as ThemeName)] ? (name as ThemeName) : "dark";
  const vars = themes[key];
  const bodyDark = DARK_SET.has(key) ? " dark" : "";
  return `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}` + (bodyDark ? `.dark{color-scheme:dark}` : ``);
}

export default themes;

