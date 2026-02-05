"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Instagram, Twitter, Youtube } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brand, hasBrandMark } from "@/config/brand";
import { cn } from "@/lib/utils";
import { isPublicProfilePathname } from "@/lib/routing";

export function Footer() {
  const year = new Date().getFullYear();
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  const isLanding = pathname === "/";
  const isPublicProfile = isPublicProfilePathname(pathname);
  const isAuth = pathname?.startsWith("/auth") || pathname?.startsWith("/forgot-password");

  if (isLanding) {
    return null;
  }
  if (isDashboard) {
    return null;
  }
  if (isPublicProfile) {
    return null;
  }

  const columns = [
    {
      heading: "Legal",
      links: [
        { href: "/privacy", label: "Privacy" },
        { href: "/terms", label: "Terms" },
        { href: "/security", label: "Security" },
        { href: "/accessibility", label: "Accessibility" },
      ],
    },
  ];

  const wrapperClass = cn("border-t bg-muted/20");

  const brandTextClass = "text-xl font-semibold tracking-tight text-[#0f172a]";

  const newsletterInputClass = "rounded-full bg-white";

  const socialLinkClass =
    "text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]";

  if (isAuth) {
    const currentYear = new Date().getFullYear();
    const footerSocials = [
      { label: "Twitter", href: "https://twitter.com/linket", icon: Twitter },
      { label: "Instagram", href: "https://instagram.com/linket", icon: Instagram },
      { label: "YouTube", href: "https://youtube.com/@linket", icon: Youtube },
    ] as const;

    return (
      <footer className="relative overflow-hidden border-t border-white/40 bg-[#050816] text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25),_rgba(5,8,22,0))]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr]">
            <div className="space-y-8">
              <div className="flex items-center gap-3 text-lg font-semibold">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={brand.logomark} alt={`${brand.name} mark`} className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/70">
                    {brand.name}
                  </p>
                  <p className="text-2xl font-bold text-white">
                    Tap once. Stay remembered.
                  </p>
                </div>
              </div>
              <p className="mt-6 text-sm text-white/70">
                Linket turns every tap into a live microsite, lead capture, and
                follow-up customers actually remember. Built for students,
                creators, and field teams who want intros that stick.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {footerSocials.map((social) => (
                  <Link
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70 transition hover:-translate-y-1 hover:text-white"
                  >
                    <social.icon className="h-5 w-5" aria-hidden />
                  </Link>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              {columns.map((column) => (
                <div key={column.heading} className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                    {column.heading}
                  </p>
                  <ul className="space-y-2 text-sm text-white/70">
                    {column.links.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="transition hover:text-white"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="space-y-6 text-sm text-white/70">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                  Contact
                </p>
                <p className="text-white/80">Contact@LinketConnect.com</p>
                <p className="text-white/60">
                  400 Bizzell St, College Station, TX
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-white">
                  Ready to keep intros warm?
                </p>
                <p className="mt-2 text-xs text-white/60">
                  Tap once and keep every follow-up effortless.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/auth?view=signin"
                    className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 transition hover:bg-white/90"
                  >
                    Get started
                  </Link>
                  <Link
                    href="#demo"
                    className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:text-white"
                  >
                    View demo
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {"\u00a9"} {currentYear} {brand.name}. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/privacy" className="transition hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="transition hover:text-white">
                Terms
              </Link>
              <Link href="/security" className="transition hover:text-white">
                Security
              </Link>
              <Link
                href="mailto:hello@linket.com"
                className="transition hover:text-white"
              >
                Contact sales
              </Link>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={wrapperClass} aria-label="Site footer">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
              aria-label={`${brand.name} home`}
            >
              {brand.logo ? (
                <Image
                  src={brand.logo}
                  alt={`${brand.name} logo`}
                  width={148}
                  height={42}
                  className="h-10 w-auto"
                  priority
                />
              ) : hasBrandMark() ? (
                <Image
                  src={(brand.logomark || brand.logo) ?? ""}
                  alt={`${brand.name} mark`}
                  width={36}
                  height={36}
                />
              ) : (
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background"
                  aria-hidden="true"
                >
                  {(brand.shortName ?? brand.name).slice(0, 2)}
                </span>
              )}
              {!brand.logo && (
                <span className={brandTextClass}>{brand.name}</span>
              )}
            </Link>
            <p className="max-w-md text-sm text-muted-foreground">
              {brand.blurb}
            </p>
            <div
              className="flex flex-col gap-3 sm:flex-row"
              role="group"
              aria-label="Join newsletter"
            >
              <Input
                type="email"
                placeholder="name@email.com"
                required
                className={newsletterInputClass}
              />
              <Button type="button" className="rounded-full">
                Get tips
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Join 5,000+ students, creators, and teams staying in the loop.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {columns.map((column) => (
              <div key={column.heading} className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {column.heading}
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {column.links.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-foreground/10 pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            {"\u00a9"} {year} {brand.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/linket"
              target="_blank"
              rel="noreferrer"
              className={socialLinkClass}
            >
              Instagram
            </a>
            <a
              href="https://www.linkedin.com/company/linket"
              target="_blank"
              rel="noreferrer"
              className={socialLinkClass}
            >
              LinkedIn
            </a>
            <a
              href="https://www.tiktok.com/@linket"
              target="_blank"
              rel="noreferrer"
              className={socialLinkClass}
            >
              TikTok
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
