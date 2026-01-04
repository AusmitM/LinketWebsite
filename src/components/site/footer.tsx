"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brand, hasBrandMark } from "@/config/brand";
import { cn } from "@/lib/utils";
import { isPublicProfilePathname } from "@/lib/routing";

export function Footer() {
  const year = new Date().getFullYear();
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  const isPublic = !isDashboard;
  const isLanding = pathname === "/";
  const isPublicProfile = isPublicProfilePathname(pathname);

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
      heading: "Product",
      links: [
        { href: "/#how-it-works", label: "How it Works" },
        { href: "/#customization", label: "Customization" },
        { href: "/#pricing", label: "Pricing" },
        { href: "/#demo", label: "Live demo" },
      ],
    },
    {
      heading: "Company",
      links: [
        { href: "/about", label: "About" },
        { href: "/blog", label: "Blog" },
        { href: "/careers", label: "Careers" },
        { href: "/press", label: "Press" },
      ],
    },
    {
      heading: "Support",
      links: [
        { href: "/#faq", label: "FAQ" },
        { href: "/contact", label: "Contact" },
        { href: "/guides", label: "Guides" },
        { href: "/status", label: "Status" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { href: "/privacy", label: "Privacy" },
        { href: "/terms", label: "Terms" },
        { href: "/returns", label: "Returns" },
        { href: "/accessibility", label: "Accessibility" },
      ],
    },
  ];

  const wrapperClass = cn("border-t bg-muted/20");

  const brandTextClass = "text-xl font-semibold tracking-tight text-[#0f172a]";

  const newsletterInputClass = "rounded-full bg-white";

  const socialLinkClass =
    "text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]";

  if (isPublic) {
    return (
      <footer
        className="border-t border-white/60 bg-white/80 py-10 backdrop-blur supports-[backdrop-filter]:bg-white/65"
        aria-label="Site footer"
      >
        <div className="mx-auto flex max-w-6xl justify-center px-4 md:px-6">
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
              <>
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background"
                  aria-hidden="true"
                >
                  {(brand.shortName ?? brand.name).slice(0, 2)}
                </span>
                <span className="text-lg font-semibold text-[#0f172a]">
                  {brand.name}
                </span>
              </>
            )}
          </Link>
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
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
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
