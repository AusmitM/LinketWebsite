"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

const DashboardSessionContext = createContext<User | null>(null);

type ProviderProps = {
  user: User;
  children: ReactNode;
};

export function DashboardSessionProvider({ user, children }: ProviderProps) {
  return <DashboardSessionContext.Provider value={user}>{children}</DashboardSessionContext.Provider>;
}

export function useDashboardUser() {
  return useContext(DashboardSessionContext);
}
