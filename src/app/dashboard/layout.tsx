import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import "@/styles/theme/dashboard.css";
import "@/styles/theme/public-profile.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import DashboardPrefetcher from "@/components/dashboard/DashboardPrefetcher";
import DashboardThemeSync from "@/components/dashboard/DashboardThemeSync";
import DashboardThemeRemoteSync from "@/components/dashboard/DashboardThemeRemoteSync";
import { getDashboardOnboardingState } from "@/lib/dashboard-onboarding";
import { getDashboardPlanAccessForUser } from "@/lib/plan-access.server";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { DashboardSessionProvider } from "@/components/dashboard/DashboardSessionContext";
import DashboardAppShell from "@/components/dashboard/DashboardAppShell";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerSupabaseReadonly();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?view=signin&next=%2Fdashboard");
  }

  const [onboardingState, planAccess] = await Promise.all([
    getDashboardOnboardingState(user.id),
    getDashboardPlanAccessForUser(user.id),
  ]);
  const initialDashboardTheme = onboardingState.activeProfile.theme;

  return (
    <ThemeProvider
      initial={initialDashboardTheme}
      scopeSelector="#dashboard-theme-scope"
      storageKey="linket:dashboard-theme"
      allowedThemes={
        planAccess.hasPaidAccess ? undefined : planAccess.allowedThemes
      }
    >
      <DashboardSessionProvider user={user} planAccess={planAccess}>
        <DashboardThemeSync />
        <DashboardThemeRemoteSync />
        <DashboardAppShell onboardingState={onboardingState}>
          <DashboardPrefetcher />
          {children}
        </DashboardAppShell>
      </DashboardSessionProvider>
    </ThemeProvider>
  );
}
