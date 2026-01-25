export type ThemeName =
  | "light"
  | "dark"
  | "midnight"
  | "dream"
  | "forest"
  | "gilded"
  | "ember"
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
    "--avatar-border": "#2563eb",
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
    "--avatar-border": "#60a5fa",
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
    "--avatar-border": "#8b5cf6",
  },
  dream: {
    "--background": "#dec1db",
    "--foreground": "#2d2b45",
    "--card": "#f8f2f9",
    "--card-foreground": "#2d2b45",
    "--muted": "#e7d7e6",
    "--muted-foreground": "#6f6a8c",
    "--accent": "#2f80e4",
    "--accent-foreground": "#f1f7ff",
    "--destructive": "#ef778f",
    "--border": "#d7c4db",
    "--input": "#d7c4db",
    "--ring": "#5b61b2",
    "--avatar-border": "#5b61b2",
  },
  forest: {
    "--background": "#1f262b",
    "--foreground": "#f5f2e8",
    "--card": "#344139",
    "--card-foreground": "#f5f2e8",
    "--muted": "#2a332f",
    "--muted-foreground": "#c1cc7a",
    "--accent": "#8e6a54",
    "--accent-foreground": "#1b120c",
    "--destructive": "#f87171",
    "--border": "#48554b",
    "--input": "#48554b",
    "--ring": "#d7e58a",
    "--avatar-border": "#d7e58a",
  },
  gilded: {
    "--background": "#010203",
    "--foreground": "#f7f0e2",
    "--card": "#1d1d1f",
    "--card-foreground": "#f7f0e2",
    "--muted": "#3b3130",
    "--muted-foreground": "#d3ac2c",
    "--accent": "#b16c04",
    "--accent-foreground": "#1a1205",
    "--destructive": "#fb7185",
    "--border": "#3b3130",
    "--input": "#3b3130",
    "--ring": "#d3ac2c",
    "--avatar-border": "#d3ac2c",
  },
  ember: {
    "--background": "#ffe1d1",
    "--foreground": "#4a1612",
    "--card": "#ffeadf",
    "--card-foreground": "#4a1612",
    "--muted": "#f9cdb8",
    "--muted-foreground": "#7a2f23",
    "--accent": "#f7b33c",
    "--accent-foreground": "#4a1612",
    "--destructive": "#ef4444",
    "--border": "#f1b59d",
    "--input": "#f1b59d",
    "--ring": "#f25c2d",
    "--avatar-border": "#f25c2d",
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
    "--avatar-border": "#d97706",
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
