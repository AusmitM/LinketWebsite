"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowUpRight, IdCard, Link2, LogOut, Menu, MessageSquare, User, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getSignedAvatarUrl } from "@/lib/avatar-client";
import { brand } from "@/config/brand";
import { AdaptiveNavPill } from "@/components/ui/3d-adaptive-navigation-bar";
import { isPublicProfilePathname } from "@/lib/routing";
import { toast } from "@/components/system/toaster";

type UserLite = { id: string; email: string | null; fullName?: string | null } | null;

const LANDING_LINKS = [
  {
    id: "how-it-works",
    label: "How it Works",
    gradient: "linear-gradient(120deg,#ff9776 0%,#ffb166 100%)",
    shadow: "0 10px 24px rgba(255,151,118,0.35)",
  },
  {
    id: "customization",
    label: "Customization",
    gradient: "linear-gradient(120deg,#ffb166 0%,#ffd27f 100%)",
    shadow: "0 10px 24px rgba(255,183,120,0.32)",
  },
  {
    id: "demo",
    label: "Demo",
    gradient: "linear-gradient(120deg,#ffd27f 0%,#ffc3a0 100%)",
    shadow: "0 10px 24px rgba(255,178,140,0.28)",
  },
  {
    id: "pricing",
    label: "Pricing",
    gradient: "linear-gradient(120deg,#ffc3a0 0%,#ff9fb7 100%)",
    shadow: "0 10px 24px rgba(255,159,183,0.28)",
  },
  {
    id: "faq",
    label: "FAQ",
    gradient: "linear-gradient(120deg,#ff9fb7 0%,#7fc8e8 100%)",
    shadow: "0 10px 24px rgba(127,200,232,0.3)",
  },
] as const;

type LandingSectionId = (typeof LANDING_LINKS)[number]["id"];

const DASHBOARD_NAV = [
  { href: "/dashboard/overview", label: "Overview" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/profiles", label: "Profiles" },
] as const;

const MARKETING_LINKS: Array<{ href: string; label: string }> = [];

const PROFILE_SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "contact", label: "Contact", icon: IdCard },
  { id: "links", label: "Links", icon: Link2 },
  { id: "lead", label: "Lead Form", icon: MessageSquare },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserLite>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [currentHash, setCurrentHash] = useState("");
  const [lockedSection, setLockedSection] = useState<string | null>(null);
  const lockTimeout = useRef<number | null>(null);
  const lockedSectionRef = useRef<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const [accountHandle, setAccountHandle] = useState<string | null>(null);
  const [copyLinkLabel, setCopyLinkLabel] = useState("copy link");
  const copyLinkTimeout = useRef<number | null>(null);
  const [dashboardSidebarOpen, setDashboardSidebarOpen] = useState(false);
  const [activeProfileSection, setActiveProfileSection] = useState<
    (typeof PROFILE_SECTIONS)[number]["id"] | null
  >(null);

  useEffect(() => {
    lockedSectionRef.current = lockedSection;
  }, [lockedSection]);

  useEffect(() => {
    return () => {
      if (lockTimeout.current) {
        window.clearTimeout(lockTimeout.current);
      }
      if (copyLinkTimeout.current) {
        window.clearTimeout(copyLinkTimeout.current);
      }
    };
  }, []);
  const isDashboard = pathname?.startsWith("/dashboard");
  const isPublicProfile = isPublicProfilePathname(pathname);
  const isPublic = !isDashboard;
  const isLandingPage = pathname === "/";
  const isAuthPage =
    pathname?.startsWith("/auth") || pathname?.startsWith("/forgot-password");
  const isProfileEditor = pathname?.startsWith("/dashboard/profiles") ?? false;
  const isMarketingPage =
    isPublic && !isLandingPage && !isPublicProfile && !isAuthPage;

  useEffect(() => {
    if (!isDashboard) {
      setUser(null);
      setAccountHandle(null);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (user) {
        setUser({
          id: user.id,
          email: user.email ?? null,
          fullName: (user.user_metadata?.full_name as string | null) ?? null,
        });
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(
        session?.user
          ? {
              id: session.user.id,
              email: session.user.email ?? null,
              fullName:
                (session.user.user_metadata?.full_name as string | null) ?? null,
            }
          : null
      );
    });
    unsubscribe = () => sub.subscription.unsubscribe();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [isDashboard]);

  useEffect(() => {
    if (!isDashboard || !user?.id) {
      setAccountHandle(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const response = await fetch(
          `/api/account/handle?userId=${encodeURIComponent(user.id)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { handle?: string | null };
        if (!active) return;
        setAccountHandle(payload.handle ?? null);
      } catch {
        if (active) setAccountHandle(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [isDashboard, user?.id]);

  useEffect(() => {
    if (!isDashboard) return;
    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ handle?: string | null }>).detail;
      if (detail?.handle) {
        setAccountHandle(detail.handle);
      }
    };
    window.addEventListener("linket:handle-updated", handleUpdated);
    return () => {
      window.removeEventListener("linket:handle-updated", handleUpdated);
    };
  }, [isDashboard]);

  useEffect(() => {
    if (!isProfileEditor) {
      setActiveProfileSection(null);
      return;
    }
    const handleSection = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      const next = detail?.section;
      if (!next) return;
      if (PROFILE_SECTIONS.some((section) => section.id === next)) {
        setActiveProfileSection(next as (typeof PROFILE_SECTIONS)[number]["id"]);
      }
    };
    window.addEventListener("linket:profile-section-updated", handleSection);
    return () => {
      window.removeEventListener("linket:profile-section-updated", handleSection);
    };
  }, [isProfileEditor]);

  useEffect(() => {
    if (!isDashboard) {
      setDashboardSidebarOpen(false);
      return;
    }
    const handleSidebarState = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      setDashboardSidebarOpen(Boolean(detail?.open));
    };
    window.addEventListener("linket:dashboard-sidebar-state", handleSidebarState);
    return () => {
      window.removeEventListener("linket:dashboard-sidebar-state", handleSidebarState);
    };
  }, [isDashboard]);

  const profileUrl = accountHandle ? buildPublicProfileUrl(accountHandle) : null;

  const handleViewProfile = () => {
    if (!profileUrl) return;
    window.open(profileUrl, "_blank", "noreferrer");
  };

  const handleCopyProfileLink = async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopyLinkLabel("link copied");
      if (copyLinkTimeout.current) {
        window.clearTimeout(copyLinkTimeout.current);
      }
      copyLinkTimeout.current = window.setTimeout(() => {
        setCopyLinkLabel("copy link");
        copyLinkTimeout.current = null;
      }, 2000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to copy link";
      toast({ title: "Copy failed", description: message, variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await fetch("/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "SIGNED_OUT" }),
      }).catch(() => null);
      toast({
        title: "Signed out",
        description: "You have been logged out safely.",
        variant: "success",
      });
      window.location.assign("/auth?view=signin");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({
        title: "Sign out failed",
        description: message,
        variant: "destructive",
      });
      setLoggingOut(false);
    }
  };

  const handleDashboardMenuToggle = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("linket:dashboard-sidebar-toggle"));
  };

  useEffect(() => {
    if (!isDashboard || !user) {
      setAvatarUrl(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
        const signed = await getSignedAvatarUrl(
          (data?.avatar_url as string | null) ?? null,
          (data?.updated_at as string | null) ?? null
        );
        setAvatarUrl(signed);
    })();
  }, [user, isDashboard]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isLandingPage || typeof window === "undefined") {
      setCurrentHash("");
      return;
    }
    const nextHash = window.location.hash || `#${LANDING_LINKS[0].id}`;
    setCurrentHash(nextHash);
    const handleHash = () =>
      setCurrentHash(window.location.hash || `#${LANDING_LINKS[0].id}`);
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [isLandingPage]);

  useEffect(() => {
    if (!isLandingPage || typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (lockedSectionRef.current) return;
        if (visible?.target?.id) {
          const nextHash = `#${visible.target.id}`;
          setCurrentHash((prev) => (prev === nextHash ? prev : nextHash));
        }
      },
      {
        threshold: [0.3, 0.5, 0.7],
        rootMargin: "-15% 0px -35% 0px",
      }
    );
    LANDING_LINKS.forEach((link) => {
      const section = document.getElementById(link.id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, [isLandingPage]);

  useEffect(() => {
    if (!isPublic) {
      setIsAtTop(true);
      return;
    }
    const handleScroll = () => {
      setIsAtTop(window.scrollY <= 16);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isPublic]);

  if (isPublicProfile) {
    return null;
  }

  const overlayMode = isPublic && isAtTop && isLandingPage;

  const headerClassName = cn(
    "top-0 z-50 w-full border-b transition-all duration-300",
    isDashboard
      ? "sticky border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      : "fixed border-white/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60",
    overlayMode &&
      "border-transparent bg-transparent text-white backdrop-blur-none supports-[backdrop-filter]:bg-transparent"
  );

  const brandNameClass = cn(
    "text-xl font-semibold tracking-tight transition-colors",
    isDashboard
      ? "text-foreground"
      : overlayMode
      ? "text-white drop-shadow"
      : "text-[#0f172a]"
  );

  const activeLandingSection = isLandingPage
    ? currentHash
      ? currentHash.replace("#", "")
      : LANDING_LINKS[0].id
    : null;

  const scrollToSection = (sectionId: LandingSectionId) => {
    if (typeof window === "undefined") return;
    const element = document.getElementById(sectionId);
    if (!element) return;
    const headerOffset = 80;
    const offsetPosition =
      element.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({
      top: Math.max(offsetPosition, 0),
      behavior: "smooth",
    });
    if (lockTimeout.current) {
      window.clearTimeout(lockTimeout.current);
    }
    setLockedSection(sectionId);
    lockTimeout.current = window.setTimeout(() => {
      setLockedSection(null);
      lockTimeout.current = null;
    }, 900);
    const hash = `#${sectionId}`;
    setCurrentHash(hash);
    window.history.replaceState(null, "", hash);
  };

  const handlePillSelect = (sectionId: string) => {
    const validSectionId = sectionId as LandingSectionId;
    if (isLandingPage) {
      scrollToSection(validSectionId);
    } else {
      router.push(`/#${validSectionId}`);
    }
  };

  const handleDropdownSelect = (sectionId: LandingSectionId) => {
    handlePillSelect(sectionId);
    setMobileOpen(false);
  };

  const mobilePanelClass = cn(
    "fixed inset-x-4 top-24 z-50 rounded-2xl border p-6 shadow-xl backdrop-blur-sm",
    isDashboard
      ? "border-border/60 bg-background/95"
      : overlayMode
      ? "border-white/30 bg-slate-900/85 text-white"
      : "border-foreground/10 bg-white"
  );

  const mobileAvatarFrame = cn(
    "inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border bg-white",
    isDashboard
      ? "border-border/60 bg-card"
      : overlayMode
      ? "border-white/40 bg-white/10"
      : ""
  );

  const desktopLinks = (
    <div className="w-full max-w-[720px] px-4">
      <AdaptiveNavPill
        items={LANDING_LINKS}
        activeId={activeLandingSection}
        onSelect={handlePillSelect}
      />
    </div>
  );

  const marketingNav = MARKETING_LINKS.length ? (
    <div className="flex w-full items-center justify-center gap-6 px-4">
      {MARKETING_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "text-sm font-semibold transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  ) : null;

  const loginButton = user ? (
    <Link
      href="/dashboard/linkets"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-semibold uppercase tracking-[0.08em] transition md:h-12 md:px-5 md:text-sm",
        isDashboard
          ? "bg-foreground text-background hover:bg-foreground/90"
          : overlayMode
          ? "border border-white/40 bg-white/5 text-white shadow-[0_16px_32px_rgba(15,23,42,0.25)] hover:bg-white/15"
          : "bg-[#0b1220] text-white shadow-[0_18px_32px_rgba(15,23,42,0.25)] hover:bg-[#141c32]"
      )}
      aria-label={`Go to ${brand.name} dashboard`}
    >
      Dashboard
    </Link>
  ) : (
    <Button
      asChild
      className={cn(
        "h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.08em] md:h-12 md:px-6 md:text-sm",
        isDashboard
          ? "border border-foreground/20 bg-background text-foreground hover:bg-foreground/5"
          : overlayMode
          ? "bg-white text-slate-900 shadow-[0_18px_35px_rgba(15,23,42,0.25)] hover:bg-white/90"
          : "bg-white text-[#0b1220] shadow-[0_12px_30px_rgba(15,23,42,0.12)] hover:bg-white/95"
      )}
      aria-label={`Log in to ${brand.name}`}
    >
      <Link href="/auth?view=signin">Sign in</Link>
    </Button>
  );

  const primaryCta = (
    <Button
      asChild
      className={cn(
        "h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.08em] md:h-12 md:px-6 md:text-sm",
        isDashboard
          ? "shadow-[0_12px_40px_rgba(16,200,120,0.15)] hover:shadow-[0_18px_45px_rgba(16,200,120,0.22)]"
          : overlayMode
          ? "bg-white text-slate-900 shadow-[0_22px_50px_rgba(15,23,42,0.35)] hover:bg-white/90"
          : "bg-gradient-to-r from-[#7fc8e8] via-[#5fb7f5] to-[#a5f3fc] text-[#0b1220] shadow-[0_20px_45px_rgba(125,200,232,0.35)] hover:bg-gradient-to-r hover:from-[#ff9776] hover:via-[#ffb166] hover:to-[#ffd27f]"
      )}
    >
      <Link href="/#pricing" aria-label="Buy Linket">
        Buy Linket
      </Link>
    </Button>
  );

  const navClassName = cn(
    "mx-auto flex max-w-6xl items-center justify-between px-3 py-2 md:px-6 md:py-3",
    overlayMode ? "text-white" : "text-foreground"
  );

  const activeLandingId = (activeLandingSection ??
    LANDING_LINKS[0].id) as LandingSectionId;

  const dashboardAvatar = user ? (
    <button
      type="button"
      ref={accountButtonRef}
      onClick={() => setAccountMenuOpen(true)}
      className="dashboard-avatar-button inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card/90 text-sm font-semibold uppercase text-foreground transition hover:bg-card"
      aria-label="Account menu"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="avatar"
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        getUserInitials(user.fullName ?? user.email ?? "PK")
      )}
    </button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      asChild
      className="rounded-full border-border/60 bg-card/80 text-foreground hover:bg-card"
    >
      <Link href="/auth?view=signin">Sign in</Link>
    </Button>
  );

  const dashboardProfileActions = user ? (
    <div className="dashboard-nav-actions hidden items-center gap-2 md:flex">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="dashboard-copy-link-button rounded-full cursor-pointer disabled:cursor-not-allowed"
        onClick={handleCopyProfileLink}
        disabled={!profileUrl}
      >
        {copyLinkLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="dashboard-view-profile-button rounded-full cursor-pointer disabled:cursor-not-allowed"
        onClick={handleViewProfile}
        disabled={!profileUrl}
        aria-label="Open public profile"
        title="Open public profile"
      >
        <span className="dashboard-view-profile-icon" aria-hidden="true">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </Button>
    </div>
  ) : null;

  if (isDashboard) {
    const overviewHref = "/dashboard/overview";
    const activeDashboardHref = (() => {
      if (!pathname) return null;
      if (!pathname.startsWith("/dashboard")) return null;
      if (pathname === "/dashboard" || pathname === overviewHref)
        return overviewHref;
      let match: string | null = null;
      for (const item of DASHBOARD_NAV) {
        if (item.href === overviewHref) continue;
        if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
          if (!match || item.href.length > match.length) {
            match = item.href;
          }
        }
      }
      return match;
    })();

    const isNavActive = (href: string) => activeDashboardHref === href;

    const dashboardLink = (link: (typeof DASHBOARD_NAV)[number]) => {
      const isActive = isNavActive(link.href);
      return (
        <Link
          key={link.href}
          href={link.href}
          data-active={isActive ? "true" : "false"}
          className={cn(
            "dashboard-nav-link rounded-full px-4 py-2 text-sm font-semibold tracking-wide transition lg:inline-flex",
            isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {link.label}
        </Link>
      );
    };

    return (
      <header className="dashboard-navbar sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <nav
          className="dashboard-navbar-inner mx-auto flex max-w-6xl items-center justify-between px-2 py-3 text-foreground sm:px-3 md:px-6"
          aria-label="Dashboard"
        >
          <div className="dashboard-navbar-left flex min-w-0 flex-1 items-center gap-4 pr-3">
            <Link
              href="/dashboard"
              className="dashboard-brand inline-flex items-center gap-3"
              aria-label={`${brand.name} dashboard`}
            >
              {brand.logo ? (
                <span className="dashboard-logo relative h-12 w-36 overflow-hidden">
                  <Image
                    src={brand.logo}
                    alt={`${brand.name} logo`}
                    fill
                    className="object-contain"
                    sizes="128px"
                    priority
                  />
                </span>
              ) : (
                <span className="dashboard-logo-fallback inline-flex h-10 w-10 items-center justify-center rounded-2xl text-lg font-bold">
                  {(brand.shortName ?? brand.name).slice(0, 2)}
                </span>
              )}
            </Link>
            {isProfileEditor ? (
              <>
                <div className="hidden min-w-0 max-w-[550px] flex-1 lg:ml-[calc(2rem)] md:flex">
                  <div className="flex min-h-[52px] w-full items-center rounded-2xl border border-border/50 bg-card/70 px-3 py-2 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.45)]">
                    <div className="flex w-full flex-nowrap items-center gap-2">
                      {PROFILE_SECTIONS.map((section) => {
                        const Icon = section.icon;
                        const isActive = activeProfileSection === section.id;
                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent("linket:profile-section-nav", {
                                  detail: { section: section.id },
                                })
                              );
                            }}
                            className={cn(
                              "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition cursor-pointer",
                              isActive
                                ? "bg-muted text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                                : "text-muted-foreground"
                            )}
                          >
                            <Icon
                              className={cn(
                                "shrink-0",
                                section.id === "contact" ? "h-7 w-7" : "h-5 w-5"
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0 truncate whitespace-nowrap">
                              {section.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div className="dashboard-navbar-right flex shrink-0 items-center gap-3">
            {dashboardProfileActions}
            <Button
              asChild
              size="sm"
              className="dashboard-new-linket-button hidden rounded-full lg:inline-flex"
            >
              <Link href="/dashboard/linkets">New Linket</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="dashboard-new-linket-button rounded-full lg:hidden"
            >
              <Link href="/dashboard/linkets">New Linket</Link>
            </Button>
            {dashboardAvatar}
            <button
              type="button"
              className="dashboard-mobile-toggle inline-flex items-center justify-center rounded-full border border-border/60 p-2 text-foreground lg:hidden"
              onClick={handleDashboardMenuToggle}
              aria-label={
                dashboardSidebarOpen ? "Close navigation" : "Open navigation"
              }
              aria-expanded={dashboardSidebarOpen}
            >
              {dashboardSidebarOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </nav>
        {user && (
          <PopoverDialog
            open={accountMenuOpen}
            onOpenChange={setAccountMenuOpen}
            anchorRef={accountButtonRef}
            align="end"
            title="Account menu"
          >
            <div className="space-y-2 text-sm">
              <div className="rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-xs text-muted-foreground">
                {user?.email ?? "Not signed in"}
              </div>
              <MenuLink href="/dashboard/settings">Account settings</MenuLink>
              <MenuLink href="/dashboard/billing">Billing</MenuLink>
              <MenuButton
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("open-support"))
                }
              >
                Support
              </MenuButton>
              <MenuButton onClick={handleLogout} disabled={loggingOut}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </MenuButton>
            </div>
          </PopoverDialog>
        )}
      </header>
    );
  }

  if (isAuthPage) {
    return (
      <header role="banner" className={headerClassName} aria-label="Site header">
        <nav className={navClassName} aria-label="Main">
          <div className="flex flex-1 items-center gap-3 md:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
              aria-label={`${brand.name} home`}
            >
              {brand.logo ? (
                <span className="relative block h-15 w-32 md:h-18 md:w-40">
                  <Image
                    src={brand.logo}
                    alt={`${brand.name} logo`}
                    fill
                    className="object-contain"
                    priority
                    sizes="(max-width: 1024px) 160px, 200px"
                  />
                </span>
              ) : (
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background"
                  aria-hidden
                >
                  {(brand.shortName ?? brand.name).slice(0, 2)}
                </span>
              )}
              {!brand.logo && (
                <span className={brandNameClass}>{brand.name}</span>
              )}
            </Link>
          </div>
        </nav>
      </header>
    );
  }

  return (
    <header role="banner" className={headerClassName} aria-label="Site header">
      <nav className={navClassName} aria-label="Main">
        <div className="flex flex-1 items-center gap-3 md:gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            aria-label={`${brand.name} home`}
          >
            {brand.logo ? (
              <span className="relative block h-15 w-32 md:h-18 md:w-40">
                <Image
                  src={brand.logo}
                  alt={`${brand.name} logo`}
                  fill
                  className="object-contain"
                  priority
                  sizes="(max-width: 1024px) 160px, 200px"
                />
              </span>
            ) : (
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background"
                aria-hidden
              >
                {(brand.shortName ?? brand.name).slice(0, 2)}
              </span>
            )}
            {!brand.logo && (
              <span className={brandNameClass}>{brand.name}</span>
            )}
          </Link>
        <div
          className="hidden flex-1 items-center justify-center lg:flex"
          aria-label="Primary"
        >
          {isLandingPage ? desktopLinks : null}
          {isMarketingPage ? marketingNav : null}
        </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {isLandingPage || isMarketingPage ? loginButton : null}
          {isLandingPage || isMarketingPage ? primaryCta : null}
          {isLandingPage || isMarketingPage ? (
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-full border p-2 transition lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                isDashboard
                  ? "border-border/60 bg-background/70 text-foreground"
                  : overlayMode
                  ? "border-white/70 bg-white/90 text-slate-900 shadow-[0_10px_25px_rgba(15,15,30,0.2)]"
                  : "border-foreground/10 bg-white/80 text-foreground"
              )}
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
      </nav>
      {(isLandingPage || isMarketingPage) && mobileOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            aria-label="Close navigation overlay"
            onClick={() => setMobileOpen(false)}
          />
          <div className={mobilePanelClass}>
            <nav aria-label="Mobile primary" className="grid gap-4">
              {isLandingPage ? (
                <Select
                  value={activeLandingId}
                  onValueChange={(value) =>
                    handleDropdownSelect(value as LandingSectionId)
                  }
                >
                  <SelectTrigger
                    className={cn(
                      "w-full justify-between rounded-2xl px-4 py-3 text-base font-semibold",
                      isDashboard
                        ? "border-border/60 bg-card/80 text-foreground hover:bg-card"
                        : overlayMode
                        ? "border-white/40 bg-white/10 text-white shadow-[0_10px_24px_rgba(15,15,30,0.18)] hover:bg-white/15"
                        : "border-foreground/10 bg-white text-[#0b1220] shadow-[0_12px_32px_rgba(15,23,42,0.12)] hover:bg-slate-50"
                    )}
                    aria-label="Jump to section"
                  >
                    <SelectValue placeholder="Navigate" />
                  </SelectTrigger>
                  <SelectContent
                    className={cn(
                      "rounded-xl shadow-lg",
                      isDashboard
                        ? "border-border/60 bg-background/95 text-foreground"
                        : overlayMode
                        ? "border-white/20 bg-slate-900 text-white"
                        : "border-foreground/10 bg-white text-[#0b1220]"
                    )}
                    position="popper"
                  >
                    {LANDING_LINKS.map((link) => (
                      <SelectItem key={link.id} value={link.id}>
                        {link.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : MARKETING_LINKS.length ? (
                <div className="grid gap-2">
                  {MARKETING_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-2xl border border-foreground/10 bg-white px-4 py-3 text-sm font-semibold text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-3">
                <div className="w-full">{primaryCta}</div>
                <div className="w-full">{loginButton}</div>
              </div>
            </nav>
            <div className="mt-4 grid gap-3">
              {user && avatarUrl ? (
                <Link
                  href="/dashboard/linkets"
                  className="flex items-center gap-3 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/80"
                >
                  <span className={mobileAvatarFrame} aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
                  </span>
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/auth?view=signin"
                  className="flex items-center rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/80"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function PopoverDialog({
  open,
  onOpenChange,
  anchorRef,
  align = "start",
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: "start" | "end";
  title?: string;
  children: React.ReactNode;
}) {
  const position = usePopoverPosition(anchorRef, open, align);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-72 translate-x-0 translate-y-0 rounded-2xl border border-border/60 bg-background p-4 shadow-lg"
        style={position}
      >
        {title ? (
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
          </DialogHeader>
        ) : null}
        {children}
      </DialogContent>
    </Dialog>
  );
}

function MenuButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-accent disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="flex w-full items-center rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-accent"
    >
      {children}
    </a>
  );
}

function usePopoverPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  align: "start" | "end"
) {
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const padding = 12;
      const maxWidth = Math.min(288, window.innerWidth - padding * 2);
      const desiredLeft = align === "end" ? rect.right - maxWidth : rect.left;
      const left = Math.min(Math.max(padding, desiredLeft), window.innerWidth - maxWidth - padding);
      const top = Math.min(rect.bottom + 8, window.innerHeight - padding);
      setStyle({
        position: "fixed",
        top,
        left,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, open, align]);

  return style;
}

function buildPublicProfileUrl(handle: string) {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL;
  const base =
    envBase && envBase.length > 0
      ? envBase
      : typeof window !== "undefined"
      ? window.location.origin
      : "https://linketconnect.com";
  return `${base.replace(/\/$/, "")}/${encodeURIComponent(handle)}`;
}

function getUserInitials(seed: string) {
  const [first, second] = String(seed).split(" ");
  const initialOne = first?.[0] ?? "P";
  const initialTwo = second?.[0] ?? "K";
  return `${initialOne}${initialTwo}`.toUpperCase();
}

export default Navbar;
