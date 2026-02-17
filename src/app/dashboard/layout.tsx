import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import "@/styles/theme/dashboard.css";
import "@/styles/theme/public-profile.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import DashboardPrefetcher from "@/components/dashboard/DashboardPrefetcher";
import DashboardThemeSync from "@/components/dashboard/DashboardThemeSync";
import DashboardThemeRemoteSync from "@/components/dashboard/DashboardThemeRemoteSync";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { DashboardSessionProvider } from "@/components/dashboard/DashboardSessionContext";
import DashboardAppShell from "@/components/dashboard/DashboardAppShell";

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

  return (
    <ThemeProvider
      scopeSelector="#dashboard-theme-scope"
      storageKey="linket:dashboard-theme"
    >
      <DashboardSessionProvider user={user}>
        <DashboardThemeSync />
        <DashboardThemeRemoteSync />
        <DashboardAppShell>
          <DashboardPrefetcher />
          {children}
        </DashboardAppShell>
      </DashboardSessionProvider>
    </ThemeProvider>
  );
}
