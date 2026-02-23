import type { ThemeName } from "@/lib/themes";
import { normalizeThemeName } from "@/lib/themes";

export const FREE_PLAN_MAX_PUBLISHED_LINKS = 3;
export const FREE_PLAN_ALLOWED_THEMES = ["light", "dark"] as const;

const FREE_THEME_SET = new Set<ThemeName>(FREE_PLAN_ALLOWED_THEMES);

export type LinkVisibilityInput = {
  isActive?: boolean | null;
  isOverride?: boolean | null;
};

export function countPublishedLinks(
  links: LinkVisibilityInput[] | null | undefined
) {
  return (links ?? []).reduce((count, link) => {
    const published = Boolean(link?.isActive) || Boolean(link?.isOverride);
    return published ? count + 1 : count;
  }, 0);
}

export function isThemeAllowedForFreePlan(
  theme: ThemeName | string | null | undefined
) {
  return FREE_THEME_SET.has(normalizeThemeName(theme, "light"));
}

export function coerceThemeForFreePlan(
  theme: ThemeName | string | null | undefined
): ThemeName {
  const normalized = normalizeThemeName(theme, "light");
  return FREE_THEME_SET.has(normalized) ? normalized : "light";
}
