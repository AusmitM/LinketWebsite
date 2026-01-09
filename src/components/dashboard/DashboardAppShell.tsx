"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import { cn } from "@/lib/utils";

export default function DashboardAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      id="dashboard-theme-scope"
      className="flex min-h-[100svh] bg-[var(--background)]"
      style={{ "--dashboard-nav-height": "64px" } as CSSProperties}
    >
      <div className="hidden h-[calc(100vh-var(--dashboard-nav-height))] lg:sticky lg:top-[var(--dashboard-nav-height)] lg:block">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="dashboard-topbar sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="dashboard-menu-button inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1.5 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" aria-hidden />
            <span className="dashboard-menu-label">Menu</span>
          </button>
          <span className="dashboard-topbar-title text-sm font-semibold text-foreground">
            Dashboard
          </span>
          <div className="dashboard-topbar-spacer h-8 w-8" aria-hidden />
        </div>
        <div className="dashboard-scroll-area flex-1 overflow-auto px-3 pb-6 pt-3 sm:px-4 sm:pb-8 sm:pt-4 lg:px-8 lg:pb-10">
          <div className="dashboard-content mx-auto w-full max-w-none lg:max-w-7xl">
            {children}
          </div>
        </div>
      </div>
      <div
        className={cn(
          "fixed inset-0 z-40 transition lg:hidden",
          sidebarOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!sidebarOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity",
            sidebarOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-72 transform border-r border-border/60 bg-background shadow-2xl transition-transform",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-foreground">
              Navigation
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-full p-2 text-muted-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <Sidebar
            variant="mobile"
            className="h-full w-full border-r-0 bg-transparent"
            onNavigate={() => setSidebarOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
