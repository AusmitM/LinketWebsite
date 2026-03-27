import { isDarkTheme, type ThemeName } from "@/lib/themes";

export const FREE_THEME_NAMES = ["light", "dark"] as const satisfies readonly ThemeName[];

const FREE_THEME_SET = new Set<ThemeName>(FREE_THEME_NAMES);

export type DashboardPlanAccess = {
  plan: "free" | "paid";
  hasPaidAccess: boolean;
  allowedThemes: ThemeName[];
  canCustomizeLeadForm: boolean;
  canViewAdvancedAnalytics: boolean;
  canLabelLeads: boolean;
  upgradeHref: string;
};

export function buildDashboardPlanAccess(
  hasPaidAccess: boolean
): DashboardPlanAccess {
  return {
    plan: hasPaidAccess ? "paid" : "free",
    hasPaidAccess,
    allowedThemes: hasPaidAccess ? [] : [...FREE_THEME_NAMES],
    canCustomizeLeadForm: hasPaidAccess,
    canViewAdvancedAnalytics: hasPaidAccess,
    canLabelLeads: hasPaidAccess,
    upgradeHref: "/dashboard/billing",
  };
}

export function getDefaultDashboardPlanAccess() {
  return buildDashboardPlanAccess(false);
}

export function isThemeAvailableForPlan(
  theme: ThemeName,
  access: Pick<DashboardPlanAccess, "hasPaidAccess"> | boolean
) {
  const hasPaidAccess =
    typeof access === "boolean" ? access : access.hasPaidAccess;
  return hasPaidAccess || FREE_THEME_SET.has(theme);
}

export function isPremiumTheme(theme: ThemeName) {
  return !FREE_THEME_SET.has(theme);
}

export function sanitizeThemeForPlan(
  theme: ThemeName,
  access: Pick<DashboardPlanAccess, "hasPaidAccess"> | boolean
): ThemeName {
  if (isThemeAvailableForPlan(theme, access)) {
    return theme;
  }

  return isDarkTheme(theme) ? "dark" : "light";
}
