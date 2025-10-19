"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import ThemeToggle from "@/components/dashboard/ThemeToggle"
import { createClient } from "@/lib/supabase/client"
import {
  LayoutDashboard,
  BarChart3,
  Radio,
  Tags,
  MessageSquare,
  CreditCard,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react"

const BASE_NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/profiles", label: "Linket Profiles", icon: Radio },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/vcard", label: "vCard", icon: Radio },
  { href: "/dashboard/linkets", label: "Linkets", icon: Tags },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

const STORAGE_KEY = "dash:sidebar-collapsed"

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    setCollapsed(saved === "1")
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0")
  }, [collapsed])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.from("admin_users").select("user_id").maybeSingle()
      if (!active) return
      setIsAdmin(Boolean(data))
    })().catch(() => {
      if (active) setIsAdmin(false)
    })
    return () => {
      active = false
    }
  }, [supabase])

  const navItems = useMemo(() => {
    if (!isAdmin) return BASE_NAV
    return [
      ...BASE_NAV,
      { href: "/dashboard/admin/mint", label: "Manufacturing", icon: Package },
    ]
  }, [isAdmin])

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-[calc(100dvh-0px)] shrink-0 border-r bg-sidebar/70 backdrop-blur md:block",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
      aria-label="Primary"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 px-3 py-4">
          <Link href="/" className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[var(--primary)]/90 to-[var(--accent)]/90 shadow" />
            {!collapsed && <span className="text-sm font-semibold">Linket</span>}
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/80 px-2 py-1.5 shadow-sm backdrop-blur">
              <ThemeToggle />
              {!collapsed && <span className="text-xs font-medium text-muted-foreground">Theme</span>}
            </div>
            <button
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
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
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {collapsed && (
                  <span className="pointer-events-none absolute left-[54px] top-1/2 hidden -translate-y-1/2 rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md ring-1 ring-border group-hover:block">
                    {item.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto space-y-2 p-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-support"))}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--primary)]/20 to-[var(--accent)]/20 px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-[var(--ring)]/40 hover:opacity-95"
            aria-label="Open support"
          >
            <HelpCircle className="h-4 w-4" /> {!collapsed && <span>Need help?</span>}
          </button>
          <div className="px-2 pb-2 text-[10px] text-muted-foreground">v0.1.0</div>
        </div>
      </div>
    </aside>
  )
}

