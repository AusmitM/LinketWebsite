"use client";

import { useCallback } from "react";
import { ArrowUpRight } from "lucide-react";
import type { ProfileLinkRecord } from "@/types/db";

function faviconForUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return null;
    return `/api/favicon?u=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return null;
  }
}

export default function PublicProfileLinksList({
  links,
  trackClicks = false,
}: {
  links: ProfileLinkRecord[];
  trackClicks?: boolean;
}) {
  const trackClick = useCallback(
    (linkId: string) => {
      if (!trackClicks) return;
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
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackClick(link.id)}
          className="group flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/80 px-4 py-3 transition hover:border-[color:var(--ring)] hover:shadow-[0_18px_45px_-35px_var(--ring)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
        >
          <div className="flex min-w-0 items-center gap-3">
            {faviconForUrl(link.url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={faviconForUrl(link.url) ?? ""}
                alt=""
                className="h-6 w-6 rounded"
                aria-hidden
              />
            ) : null}
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-foreground">
                {link.title}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {link.url}
              </div>
            </div>
          </div>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground transition group-hover:text-foreground">
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </span>
        </a>
      ))}
    </div>
  );
}
