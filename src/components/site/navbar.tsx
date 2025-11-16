"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildAvatarPublicUrl } from "@/lib/avatar-utils";
import { brand } from "@/config/brand";

type UserLite = { id: string; email: string | null } | null;

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it Works" },
  { href: "/#customization", label: "Customization" },
  { href: "/#teams", label: "For Teams" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserLite>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const isDashboard = pathname?.startsWith("/dashboard");
  const isPublic = !isDashboard;

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
    ? "bg-white/15 text-white/90 shadow-[0_22px_55px_rgba(15,15,30,0.35)] hover:bg-white/20 hover:text-white"
    : "text-slate-700 hover:bg-slate-100";
  const navLinkActive = isDashboard
    ? "text-foreground"
    : overlayMode
    ? "bg-white text-[#0f172a] shadow-[0_24px_60px_rgba(15,15,30,0.35)]"
    : "text-[#0f172a]";

  const mobilePanelClass = cn(
    "fixed inset-x-4 top-24 z-50 rounded-2xl border p-6 shadow-xl backdrop-blur-sm",
    isDashboard
      ? "border-border/60 bg-background/95"
      : overlayMode
      ? "border-white/30 bg-slate-900/85 text-white"
      : "border-foreground/10 bg-white"
  );

  const mobileLinkClass = cn(
    "block rounded-xl px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
    isDashboard
      ? "text-foreground/80 hover:bg-foreground/10"
      : overlayMode
      ? "text-white/80 hover:bg-white/10"
      : "text-slate-700 hover:bg-slate-100"
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
    <ul className="hidden items-center gap-1.5 lg:flex" aria-label="Primary">
      {NAV_LINKS.map((link) => {
        const isAnchor = link.href.includes("#");
        const active = isAnchor ? pathname === "/" : pathname === link.href;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              className={cn(navLinkBase, navLinkTone, active && navLinkActive)}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const loginButton = user ? (
    <Link
      href="/dashboard/linkets"
      className={cn(
        "hidden items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition lg:inline-flex",
        isDashboard
          ? "bg-foreground text-background hover:bg-foreground/90"
          : overlayMode
          ? "border border-white/30 bg-white/10 text-white hover:bg-white/20"
          : "bg-foreground text-background hover:bg-foreground/90"
      )}
      aria-label={`Go to ${brand.name} dashboard`}
    >
      Dashboard
    </Link>
  ) : (
    <Link
      href="/auth?view=signin"
      className={cn(
        "hidden items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition lg:inline-flex",
        isDashboard
          ? "border border-foreground/20 text-foreground hover:border-foreground/40 hover:bg-foreground/5"
          : overlayMode
          ? "border border-white/30 text-white hover:bg-white/10"
          : "border border-foreground/20 text-foreground hover:border-foreground/40 hover:bg-foreground/5"
      )}
      aria-label={`Log in to ${brand.name}`}
    >
      Sign in
    </Link>
  );

  const primaryCta = (
    <Button
      asChild
      className={cn(
        "rounded-full",
        isDashboard
          ? "shadow-[0_12px_40px_rgba(16,200,120,0.15)] hover:shadow-[0_18px_45px_rgba(16,200,120,0.22)]"
          : overlayMode
          ? "bg-white text-slate-900 shadow-[0_20px_45px_rgba(15,23,42,0.35)] hover:bg-white/90"
          : "shadow-[0_18px_45px_rgba(56,189,248,0.25)] hover:shadow-[0_24px_55px_rgba(56,189,248,0.35)]"
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

  return (
    <header role="banner" className={headerClassName} aria-label="Site header">
      <nav className={navClassName} aria-label="Main">
        <div className="flex items-center gap-6">
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
          {desktopLinks}
        </div>
        <div className="flex items-center gap-3">
          {loginButton}
          {primaryCta}
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-full border p-2 lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
              isDashboard
                ? "border-border/60 text-foreground"
                : overlayMode
                ? "border-white/40 text-white"
                : "border-foreground/10"
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
              <ul className="flex flex-col gap-2 text-sm font-medium">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={mobileLinkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
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
