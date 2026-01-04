import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ThemeProvider } from "@/components/theme/theme-provider";
import DashboardPrefetcher from "@/components/dashboard/DashboardPrefetcher";
import DashboardThemeSync from "@/components/dashboard/DashboardThemeSync";
import { createServerSupabase } from "@/lib/supabase/server";
import { DashboardSessionProvider } from "@/components/dashboard/DashboardSessionContext";
import DashboardAppShell from "@/components/dashboard/DashboardAppShell";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerSupabase();
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
        <DashboardAppShell>
          <DashboardPrefetcher />
          {children}
        </DashboardAppShell>
      </DashboardSessionProvider>
    </ThemeProvider>
  );
}
