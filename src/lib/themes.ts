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

const DARK_SET: Set<ThemeName> = new Set([
  "dark",
  "midnight",
  "forest",
  "gilded",
  "burnt-orange",
  "maroon",
]);

export function isDarkTheme(name: ThemeName) {
  return DARK_SET.has(name);
}
