"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Menu, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildAvatarPublicUrl } from "@/lib/avatar-utils";
import { brand } from "@/config/brand";
import { AdaptiveNavPill } from "@/components/ui/3d-adaptive-navigation-bar";

type UserLite = { id: string; email: string | null } | null;

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

const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Overview" },
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
  const isPublic = !isDashboard;
  const isLandingPage = pathname === "/";

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
      if (user) setUser({ id: user.id, email: user.email ?? null });
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(
        session?.user
          ? { id: session.user.id, email: session.user.email ?? null }
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

  const overlayMode = isPublic && isAtTop;

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

  const navLinkBase =
    "rounded-full px-4 py-2 text-sm transition shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]";
  const navLinkTone = isDashboard
    ? "text-foreground/80 hover:bg-foreground/10"
    : overlayMode
    ? "border border-white/60 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(255,255,255,0.7))] text-slate-900 shadow-[0_18px_35px_rgba(15,15,30,0.18)] hover:bg-white"
    : "text-slate-700 hover:bg-slate-100";
  const navLinkActive = isDashboard
    ? "text-foreground"
    : overlayMode
    ? "border border-white bg-white text-[#0f172a] shadow-[0_20px_45px_rgba(15,15,30,0.28)]"
    : "text-[#0f172a]";

  const activeLandingSection = isLandingPage
    ? currentHash
      ? currentHash.replace("#", "")
      : LANDING_LINKS[0].id
    : null;

  const scrollToSection = (sectionId: string) => {
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
    if (isLandingPage) {
      scrollToSection(sectionId);
    } else {
      router.push(`/#${sectionId}`);
    }
  };

  const handleNavLinkClick = (
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: (typeof LANDING_LINKS)[number]["id"],
    closeMenu?: boolean
  ) => {
    if (!isLandingPage) {
      if (closeMenu) setMobileOpen(false);
      return;
    }
    event.preventDefault();
    if (closeMenu) setMobileOpen(false);
    scrollToSection(sectionId);
  };

  const mobilePanelClass = cn(
    "fixed inset-x-4 top-24 z-50 rounded-2xl border p-6 shadow-xl backdrop-blur-sm",
    isDashboard
      ? "border-border/60 bg-background/95"
      : overlayMode
      ? "border-white/30 bg-slate-900/85 text-white"
      : "border-foreground/10 bg-white"
  );

  const mobileLinkBase = cn(
    "block rounded-2xl px-4 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
    isDashboard ? "text-foreground/80 hover:bg-foreground/10" : "text-[#0f172a]"
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
        "inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold uppercase tracking-[0.08em] transition",
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
        "h-12 rounded-full px-6 text-sm font-semibold uppercase tracking-[0.08em]",
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
        "h-12 rounded-full px-6 text-sm font-semibold uppercase tracking-[0.08em]",
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
    "mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6",
    overlayMode ? "text-white" : "text-foreground"
  );

  const dashboardAvatar = user ? (
    <Link
      href="/dashboard/profile"
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card/90 text-sm font-semibold uppercase text-foreground transition hover:bg-card"
      aria-label="Account"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="avatar"
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        (user.email ?? "LL").slice(0, 2).toUpperCase()
      )}
    </Link>
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
    const activeDashboardHref = (() => {
      if (!pathname) return null;
      if (!pathname.startsWith("/dashboard")) return null;
      if (pathname === "/dashboard") return "/dashboard";
      let match: string | null = null;
      for (const item of DASHBOARD_NAV) {
        if (item.href === "/dashboard") continue;
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
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground/10 text-lg font-bold text-foreground">
                {(brand.shortName ?? brand.name).slice(0, 2)}
              </span>
              <span className="hidden text-lg font-semibold text-foreground lg:inline">
                {brand.name}
              </span>
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
              <Link href="/dashboard/linkets/new">New Linket</Link>
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
                <Link href="/dashboard/linkets/new">New Linket</Link>
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
      </header>
    );
  }

  return (
    <header role="banner" className={headerClassName} aria-label="Site header">
      <nav className={navClassName} aria-label="Main">
        <div className="flex flex-1 items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            aria-label={`${brand.name} home`}
          >
            {brand.logo ? (
              <span className="relative block h-10 w-40">
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
            {desktopLinks}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {loginButton}
          {primaryCta}
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
        </div>
      </nav>
      {mobileOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            aria-label="Close navigation overlay"
            onClick={() => setMobileOpen(false)}
          />
          <div className={mobilePanelClass}>
            <nav aria-label="Mobile primary">
              <ul className="flex flex-col gap-2 text-sm">
                {LANDING_LINKS.map((link) => {
                  const isActive =
                    isLandingPage && activeLandingSection === link.id;
                  const accentShadow =
                    link.shadow ?? "0 8px 20px rgba(15,23,42,0.15)";
                  return (
                    <li key={link.id}>
                      <Link
                        href={`/#${link.id}`}
                        className={cn(
                          mobileLinkBase,
                          isActive ? "font-semibold" : "font-medium",
                          !isDashboard && "text-[#0b1220]"
                        )}
                        style={
                          !isDashboard
                            ? {
                                backgroundImage: link.gradient,
                                opacity: isActive ? 1 : 0.78,
                                border: "1px solid rgba(255,255,255,0.5)",
                                boxShadow: isActive
                                  ? accentShadow
                                  : "inset 0 0 0 1px rgba(255,255,255,0.35)",
                              }
                            : undefined
                        }
                        onClick={(event) =>
                          handleNavLinkClick(event, link.id, true)
                        }
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="mt-6 grid gap-3">
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

export default Navbar;
