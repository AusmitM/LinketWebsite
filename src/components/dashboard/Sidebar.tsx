"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/dashboard/ThemeToggle";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  CreditCard,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Package,
  User,
} from "lucide-react";

const BASE_NAV = [
  { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
  {
    href: "/dashboard/profiles",
    label: "Linket Public Profile",
    icon: User,
  },
  { href: "/dashboard/leads", label: "Leads", icon: MessageSquare },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const STORAGE_KEY = "dash:sidebar-collapsed";

export default function Sidebar({
  className,
  variant = "desktop",
  onNavigate,
}: {
  className?: string;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const isMobile = variant === "mobile";
  const isProfileEditor = pathname?.startsWith("/dashboard/profiles") ?? false;
  const canCollapse = !isMobile;
  const isCollapsed = canCollapse && collapsed;

  useEffect(() => {
    if (isMobile) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    setCollapsed(saved === "1");
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed, isMobile]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;
      const userId = userData.user?.id;
      if (!userId) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from("admin_users")
        .select("id,user_id")
        .eq("user_id", userId)
        .limit(1);
      if (!active) return;
      if (error) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(Array.isArray(data) ? data.length > 0 : Boolean(data));
    })().catch(() => {
      if (active) setIsAdmin(false);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  const navItems = useMemo(() => {
    if (!isAdmin) return BASE_NAV;
    return [
      ...BASE_NAV,
      { href: "/dashboard/admin/mint", label: "Minting", icon: Package },
    ];
  }, [isAdmin]);


  const shouldConfirmLeave = useCallback(() => {
    if (typeof window === "undefined") return false;
    const state = (window as Window & {
      __linketProfileEditorState?: {
        hasUnsavedChanges?: boolean;
        saveFailed?: boolean;
      };
    }).__linketProfileEditorState;
    return Boolean(state?.hasUnsavedChanges || state?.saveFailed);
  }, []);

  const requestAutosave = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("linket:save-request"));
  }, []);

  const requestNavigation = useCallback(
    (href: string) => {
      requestAutosave();
      if (isProfileEditor && shouldConfirmLeave()) {
        setPendingHref(href);
        setConfirmOpen(true);
        return;
      }
      onNavigate?.();
      router.push(href);
    },
    [isProfileEditor, onNavigate, requestAutosave, router, shouldConfirmLeave]
  );

  const confirmLeave = useCallback(() => {
    setConfirmOpen(false);
    if (pendingHref) {
      onNavigate?.();
      router.push(pendingHref);
      setPendingHref(null);
    }
  }, [onNavigate, pendingHref, router]);

  return (
    <aside
      className={cn(
        "dashboard-sidebar h-full shrink-0 border-r bg-sidebar/70 backdrop-blur",
        isCollapsed ? "w-[72px]" : "w-[200px]",
        className
      )}
      aria-label="Primary"
    >
      <div className="flex min-h-full flex-col">
        <div className="flex items-center justify-end gap-2 px-4 py-5">
          {canCollapse && (
            <button
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        <div className={cn("px-3 pb-2", isCollapsed && "flex justify-center")}>
          <ThemeToggle showLabel={!isCollapsed || isMobile} />
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href === "/dashboard/overview" && pathname === "/dashboard");
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm outline-none transition",
                  active
                    ? "bg-gradient-to-r from-[var(--primary)]/20 to-[var(--accent)]/20 text-foreground ring-1 ring-[var(--ring)]/40 shadow-[var(--shadow-ambient)]"
                    : "text-muted-foreground hover:bg-accent"
                )}
                onClick={(event) => {
                  requestAutosave();
                  if (!isProfileEditor) {
                    onNavigate?.();
                    return;
                  }
                  event.preventDefault();
                  requestNavigation(item.href);
                }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {(!isCollapsed || isMobile) && (
                  <span className="truncate">{item.label}</span>
                )}
                {isCollapsed && !isMobile && (
                  <span className="pointer-events-none absolute left-[54px] top-1/2 hidden -translate-y-1/2 rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md ring-1 ring-border group-hover:block">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 p-2">
          <button
            onClick={() => {
              requestAutosave();
              window.dispatchEvent(new CustomEvent("open-support"));
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--primary)]/20 to-[var(--accent)]/20 px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-[var(--ring)]/40 hover:opacity-95"
            aria-label="Open support"
          >
            <HelpCircle className="h-4 w-4" />{" "}
            {!isCollapsed && <span>Need help?</span>}
          </button>
          <div className="px-2 pb-2 text-[10px] text-muted-foreground">
            v0.1.0
          </div>
        </div>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave this page?</DialogTitle>
            <DialogDescription>You have unsaved changes.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Stay
            </Button>
            <Button type="button" onClick={confirmLeave}>
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
