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
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null);
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

  const headerClassName = cn(
    "sticky top-0 z-40 w-full border-b backdrop-blur transition-colors",
    isDashboard
      ? "border-border/60 bg-background/80 supports-[backdrop-filter]:bg-background/60"
      : "border-white/70 bg-white/80 supports-[backdrop-filter]:bg-white/60"
  );

  const brandNameClass = cn("text-xl font-semibold tracking-tight", isDashboard ? "text-foreground" : "text-[#0f172a]");

  const navLinkBase = "rounded-full px-4 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]";
  const navLinkTone = isDashboard
    ? "text-foreground/80 hover:bg-foreground/10"
    : "text-slate-700 hover:bg-slate-100";
  const navLinkActive = isDashboard ? "text-foreground" : "text-[#0f172a]";

  const mobilePanelClass = cn(
    "fixed inset-x-4 top-24 z-50 rounded-2xl border p-6 shadow-xl backdrop-blur-sm",
    isDashboard ? "border-border/60 bg-background/95" : "border-foreground/10 bg-white"
  );

  const mobileLinkClass = cn(
    "block rounded-xl px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
    isDashboard ? "text-foreground/80 hover:bg-foreground/10" : "text-slate-700 hover:bg-slate-100"
  );

  const mobileAvatarFrame = cn(
    "inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border bg-white",
    isDashboard && "border-border/60 bg-card"
  );

  const desktopLinks = (
    <ul className="hidden items-center gap-1.5 lg:flex" aria-label="Primary">
      {NAV_LINKS.map((link) => {
        const isAnchor = link.href.includes("#");
        const active = isAnchor ? pathname === "/" : pathname === link.href;
        return (
          <li key={link.href}>
            <Link href={link.href} className={cn(navLinkBase, navLinkTone, active && navLinkActive)}>
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
      className="hidden items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition hover:bg-foreground/90 lg:inline-flex"
      aria-label={`Go to ${brand.name} dashboard`}
    >
      Dashboard
    </Link>
  ) : (
    <Link
      href="/auth?view=signin"
      className="hidden items-center gap-2 rounded-full border border-foreground/20 px-5 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/40 hover:bg-foreground/5 lg:inline-flex"
      aria-label={`Log in to ${brand.name}`}
    >
      Sign in
    </Link>
  );

  const primaryCta = (
    <Button asChild className={cn("rounded-full", isDashboard && "shadow-[0_12px_40px_rgba(16,200,120,0.15)] hover:shadow-[0_18px_45px_rgba(16,200,120,0.22)]") }>
      <Link href="/pricing" aria-label={`Get ${brand.shortName ?? brand.name}`}>
        {`Get ${brand.shortName ?? brand.name}`}
      </Link>
    </Button>
  );

  if (isPublic) {
    return (
      <header role="banner" className="sticky top-0 z-40 w-full border-b border-white/40 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60" aria-label="Site header">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6" aria-label="Main">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            aria-label={`${brand.name} home`}
          >
            {brand.logo ? (
              <span className="relative block h-9 w-36">
                <Image src={brand.logo} alt={`${brand.name} logo`} fill className="object-contain" sizes="144px" priority />
              </span>
            ) : (
              <>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background" aria-hidden>
                  {(brand.shortName ?? brand.name).slice(0, 2)}
                </span>
                <span className="text-lg font-semibold tracking-tight text-[#0f172a]">{brand.name}</span>
              </>
            )}
          </Link>
        </nav>
      </header>
    );
  }

  return (
    <header role="banner" className={headerClassName} aria-label="Site header">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-foreground md:px-6" aria-label="Main">
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
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background" aria-hidden>
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
              isDashboard ? "border-border/60 text-foreground" : "border-foreground/10"
            )}
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
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
                <Link href="/dashboard/linkets" className="flex items-center gap-3 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/80">
                    <span className={mobileAvatarFrame} aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                    </span>
                    Dashboard
                  </Link>
              ) : (
                <Link href="/auth?view=signin" className="flex items-center rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/80">
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


