import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Script from "next/script";

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
import { isDarkTheme } from "@/lib/themes";

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
  const bootstrapDashboardThemeScript = `
    (() => {
      const theme = ${JSON.stringify(initialDashboardTheme)};
      const isDark = ${JSON.stringify(isDarkTheme(initialDashboardTheme))};
      const applyTheme = (target) => {
        if (!target) return;
        Array.from(target.classList)
          .filter((name) => name.startsWith("theme-"))
          .forEach((name) => target.classList.remove(name));
        target.classList.add("theme-" + theme);
        target.classList.toggle("dark", isDark);
      };

      applyTheme(document.documentElement);
      applyTheme(document.body);
    })();
  `;

  return (
    <>
      <Script id="dashboard-theme-bootstrap" strategy="beforeInteractive">
        {bootstrapDashboardThemeScript}
      </Script>
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
    </>
  );
}
