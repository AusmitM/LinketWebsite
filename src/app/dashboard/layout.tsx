import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ThemeProvider } from "@/components/theme/theme-provider";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardPrefetcher from "@/components/dashboard/DashboardPrefetcher";
import DashboardThemeSync from "@/components/dashboard/DashboardThemeSync";
import { createServerSupabase } from "@/lib/supabase/server";
import { DashboardSessionProvider } from "@/components/dashboard/DashboardSessionContext";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?view=signin&next=%2Fdashboard");
  }

  return (
    <ThemeProvider scopeSelector="#dashboard-theme-scope" storageKey="linket:dashboard-theme">
      <DashboardSessionProvider user={user}>
        <DashboardThemeSync />
        <div id="dashboard-theme-scope" className="relative flex min-h-[80dvh] gap-0 overflow-hidden bg-[var(--background)]">
          <Sidebar />
          <DashboardPrefetcher />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-w-0 flex-1 overflow-auto px-4 pb-10 pt-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-7xl">{children}</div>
            </div>
          </div>
        </div>
      </DashboardSessionProvider>
    </ThemeProvider>
  );
}
