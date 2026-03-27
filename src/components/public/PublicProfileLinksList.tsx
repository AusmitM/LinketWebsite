"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { emitAnalyticsEvent } from "@/lib/analytics";
import { sanitizePublicLinkUrl } from "@/lib/security";
import type { ProfileLinkRecord } from "@/types/db";
import { coerceThemeName, isDarkTheme } from "@/lib/themes";
import ThemeToggle from "../dashboard/ThemeToggle";

function faviconForUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host) return null;
    if (host === "instagr.am" || host.endsWith(".instagram.com") || host === "instagram.com") {
      return "/icons/instagram-logo.png";
    }
    if (host.endsWith(".github.com") || host === "github.com") {
      return "/icons/github-logo.png";
    }
    if (host.endsWith(".tiktok.com") || host === "tiktok.com") {
      return "/icons/tiktok-logo.png";
    }
    if (host.endsWith(".youtube.com") || host === "youtube.com") {
      return "/icons/yt-logo.png";
    }
    return `/api/favicon?u=${encodeURIComponent(parsed.toString())}&v=2`;
  } catch {
    return null;
  }
}

function toLinkMonogram(title: string) {
  const cleaned = title.trim();
  if (!cleaned) return "L";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "L";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function LinkIcon({ title, url }: { title: string; url: string }) {
  const [failed, setFailed] = useState(false);
  const src = faviconForUrl(url);
  const monogram = toLinkMonogram(title);

  if (!src || failed) {
    return (
      <span className="public-profile-link-icon-fallback" aria-hidden>
        {monogram}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="public-profile-link-icon h-10 w-10 rounded"
      aria-hidden
    />
  );
}

export default function PublicProfileLinksList({
  links,
  trackClicks = false,
}: {
  links: ProfileLinkRecord[];
  trackClicks?: boolean;
}) {
  const safeLinks = links
    .map((link) => {
      try {
        return {
          ...link,
          url: sanitizePublicLinkUrl(link.url),
        };
      } catch {
        return null;
      }
    })
    .filter((link): link is ProfileLinkRecord => Boolean(link));

  const trackClick = useCallback(
    (linkId: string) => {
      if (!trackClicks) return;
      emitAnalyticsEvent({
        id: "profile_link_click",
        meta: { linkId, source: "public_profile_link" },
      });
      const payload = JSON.stringify({ linkId });
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const blob = new Blob([payload], { type: "application/json" });
        const sent = navigator.sendBeacon("/api/profile-links/click", blob);
        if (sent) return;
      }
      void fetch("/api/profile-links/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    },
    [trackClicks]
  );

  return (
    <div className="grid gap-3">
      {safeLinks.map((link, index) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackClick(link.id)}
          style={{ "--public-profile-delay": `${430 + index * 70}ms` } as CSSProperties}
          className="public-profile-link public-profile-link-entrance group flex min-w-0 items-center justify-between gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card/80 px-4 py-3 transition hover:border-[color:var(--ring)] hover:shadow-[0_18px_45px_-35px_var(--ring)] focus-visible:outline-none focus-visible:[box-shadow:0_0_0_2px_var(--color-button-focus-offset),0_0_0_5px_var(--color-button-focus-ring),0_18px_45px_-35px_var(--ring)]"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <LinkIcon title={link.title} url={link.url} />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-foreground">
                {link.title}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {link.url}
              </div>
            </div>
          </div>
          <span className="public-profile-link-action inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition">
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </span>
        </a>
      ))}
    </div>
  );
}
