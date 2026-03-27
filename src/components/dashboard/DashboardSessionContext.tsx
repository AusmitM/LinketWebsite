"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  getDefaultDashboardPlanAccess,
  type DashboardPlanAccess,
} from "@/lib/plan-access";

type DashboardSessionState = {
  user: User;
  planAccess: DashboardPlanAccess;
};

const DashboardSessionContext = createContext<DashboardSessionState | null>(null);

type ProviderProps = {
  planAccess: DashboardPlanAccess;
  user: User;
  children: ReactNode;
};

export function DashboardSessionProvider({
  user,
  planAccess,
  children,
}: ProviderProps) {
  return (
    <DashboardSessionContext.Provider value={{ user, planAccess }}>
      {children}
    </DashboardSessionContext.Provider>
  );
}

export function useDashboardUser() {
  return useContext(DashboardSessionContext)?.user ?? null;
}

export function useDashboardPlanAccess() {
  return (
    useContext(DashboardSessionContext)?.planAccess ??
    getDefaultDashboardPlanAccess()
  );
}
