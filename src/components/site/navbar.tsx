"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { LogOut, Menu, X } from "lucide-react";

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
import { buildAvatarPublicUrl } from "@/lib/avatar-utils";
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

  useEffect(() => {
    lockedSectionRef.current = lockedSection;
  }, [lockedSection]);

  useEffect(() => {
    return () => {
      if (lockTimeout.current) {
        window.clearTimeout(lockTimeout.current);
      }
    };
  }, []);
  const isDashboard = pathname?.startsWith("/dashboard");
  const isPublicProfile = isPublicProfilePathname(pathname);
  const isPublic = !isDashboard;
  const isLandingPage = pathname === "/";
  const isAuthPage =
    pathname?.startsWith("/auth") || pathname?.startsWith("/forgot-password");

  if (isPublicProfile) {
    return null;
  }

  useEffect(() => {
    if (!isDashboard) {
      setUser(null);
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
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(
        session?.user
          ? {
              id: session.user.id,
              email: session.user.email ?? null,
              fullName:
                (session.user.user_metadata?.full_name as string | null) ??
                null,
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
      setAvatarUrl(
        buildAvatarPublicUrl(
          (data?.avatar_url as string | null) ?? null,
          (data?.updated_at as string | null) ?? null
        )
      );
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
      <Link href="/pricing" aria-label={`Buy ${brand.shortName ?? brand.name}`}>
        {`Buy ${brand.shortName ?? brand.name}`}
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
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card/90 text-sm font-semibold uppercase text-foreground transition hover:bg-card"
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

  if (isDashboard) {
    const mobileNavItemClass = cn(
      "rounded-2xl border px-4 py-2 text-base font-semibold transition",
      "border-border/60 bg-card/80 text-foreground hover:bg-card"
    );
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
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold tracking-wide transition lg:inline-flex",
            isActive
              ? "bg-foreground text-background shadow-[var(--shadow-ambient)]"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {link.label}
        </Link>
      );
    };

    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-foreground md:px-6"
          aria-label="Dashboard"
        >
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2"
              aria-label={`${brand.name} dashboard`}
            >
              {brand.logo ? (
                <span className="relative h-15 w-32 overflow-hidden">
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
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground/10 text-lg font-bold text-foreground">
                  {(brand.shortName ?? brand.name).slice(0, 2)}
                </span>
              )}
            </Link>
            <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/80 px-2 py-1 lg:flex">
              {DASHBOARD_NAV.map(dashboardLink)}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              asChild
              size="sm"
              className="hidden rounded-full bg-gradient-to-r from-[#6ee7b7] via-[#3b82f6] to-[#8b5cf6] text-white shadow-[0_20px_40px_rgba(59,130,246,0.35)] hover:scale-[1.01] lg:inline-flex"
            >
              <Link href="/claim">New Linket</Link>
            </Button>
            {dashboardAvatar}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-border/60 p-2 text-foreground lg:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </nav>
        {mobileOpen && (
          <div className="border-t border-border/60 bg-background/95 px-4 pb-6 pt-4 text-foreground lg:hidden">
            <nav
              className="flex flex-col gap-2"
              aria-label="Dashboard sections"
            >
              {DASHBOARD_NAV.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    mobileNavItemClass,
                    isNavActive(link.href) &&
                      "border-foreground/40 bg-card text-foreground font-semibold"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Button
                asChild
                size="sm"
                className="mt-3 w-full rounded-2xl bg-gradient-to-r from-[#6ee7b7] via-[#3b82f6] to-[#8b5cf6] text-white shadow-[0_18px_35px_rgba(59,130,246,0.35)]"
              >
                <Link href="/claim">New Linket</Link>
              </Button>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                {dashboardAvatar}
                <div className="text-sm text-muted-foreground">
                  {user?.email ?? "Not signed in"}
                </div>
              </div>
            </nav>
          </div>
        )}
        {user && (
          <PopoverDialog
            open={accountMenuOpen}
            onOpenChange={setAccountMenuOpen}
            anchorRef={accountButtonRef}
            title="Account menu"
          >
            <div className="space-y-2 text-sm">
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
      <header className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-white/80 backdrop-blur">
        <nav
          className="mx-auto flex max-w-6xl items-center px-4 py-3 md:px-6"
          aria-label="Main"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            aria-label={`${brand.name} home`}
          >
            {brand.logo ? (
              <span className="relative block h-8 w-32 md:h-10 md:w-40">
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
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {isLandingPage ? loginButton : null}
          {isLandingPage ? primaryCta : null}
          {isLandingPage ? (
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
      {isLandingPage && mobileOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            aria-label="Close navigation overlay"
            onClick={() => setMobileOpen(false)}
          />
          <div className={mobilePanelClass}>
            <nav aria-label="Mobile primary" className="grid gap-4">
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
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  title: string;
  children: React.ReactNode;
}) {
  const position = usePopoverPosition(anchorRef, open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-72 translate-x-0 translate-y-0 rounded-2xl border border-border/60 bg-background p-4 shadow-lg"
        style={position}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
        </DialogHeader>
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
  open: boolean
) {
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const top = rect.bottom + 8;
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - 300);
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
  }, [anchorRef, open]);

  return style;
}

function getUserInitials(seed: string) {
  const [first, second] = String(seed).split(" ");
  const initialOne = first?.[0] ?? "P";
  const initialTwo = second?.[0] ?? "K";
  return `${initialOne}${initialTwo}`.toUpperCase();
}

export default Navbar;
