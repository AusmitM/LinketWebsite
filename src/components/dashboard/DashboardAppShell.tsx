"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
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

  useEffect(() => {
    const handleToggle = () => setSidebarOpen((prev) => !prev);
    const handleOpen = () => setSidebarOpen(true);
    const handleClose = () => setSidebarOpen(false);
    window.addEventListener("linket:dashboard-sidebar-toggle", handleToggle);
    window.addEventListener("linket:dashboard-sidebar-open", handleOpen);
    window.addEventListener("linket:dashboard-sidebar-close", handleClose);
    return () => {
      window.removeEventListener("linket:dashboard-sidebar-toggle", handleToggle);
      window.removeEventListener("linket:dashboard-sidebar-open", handleOpen);
      window.removeEventListener("linket:dashboard-sidebar-close", handleClose);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("linket:dashboard-sidebar-state", {
        detail: { open: sidebarOpen },
      })
    );
  }, [sidebarOpen]);

  return (
    <div
      id="dashboard-theme-scope"
      className="flex min-h-[100svh] bg-[var(--background)]"
      style={{ "--dashboard-nav-height": "64px" } as CSSProperties}
    >
      <div className="relative z-30 hidden h-[calc(100vh-var(--dashboard-nav-height))] lg:sticky lg:top-[var(--dashboard-nav-height)] lg:block">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
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
            "dashboard-sidebar-overlay absolute inset-0 bg-black/40 transition-opacity",
            sidebarOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={cn(
            "dashboard-sidebar-panel absolute inset-x-0 bottom-0 max-h-[80vh] w-full transform rounded-t-3xl border-t border-border/60 bg-background shadow-2xl transition-transform duration-500 ease-in-out will-change-transform",
            sidebarOpen ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="relative flex items-center justify-center px-4 py-3">
            <span className="text-sm font-semibold text-foreground">
              Navigation
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-4 rounded-full p-2 text-muted-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <Sidebar
            variant="mobile"
            className="h-full w-full border-r-0 bg-transparent pb-4"
            onNavigate={() => setSidebarOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
