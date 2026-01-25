"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { ProfileLinkRecord } from "@/types/db";

type LinksAppearance = {
  background: string;
  border: string;
  text: string;
  muted: string;
  hover: string;
};

function apiFavicon(u: string): string | null {
  try {
    return `/api/favicon?u=${encodeURIComponent(new URL(u).toString())}`;
  } catch {
    return null;
  }
}

function s2Favicon(u: string): string | null {
  try {
    const host = new URL(u).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return null;
  }
}

function byOrder(a: ProfileLinkRecord, b: ProfileLinkRecord) {
  return (a.order_index ?? 0) - (b.order_index ?? 0) || a.created_at.localeCompare(b.created_at);
}

function filterLinks(list: ProfileLinkRecord[]) {
  return (list || []).filter((item) => item.is_active).slice().sort(byOrder);
}

function useFilteredLinks(initial: ProfileLinkRecord[]) {
  return useMemo(() => filterLinks(initial), [initial]);
}

export default function PublicLinks({
  profileId,
  initial,
  appearance,
  className,
  variant = "cards",
}: {
  profileId?: string | null;
  initial: ProfileLinkRecord[];
  appearance?: LinksAppearance;
  className?: string;
  variant?: "cards" | "buttons";
}) {
  const filtered = useFilteredLinks(initial);
  const [links, setLinks] = useState<ProfileLinkRecord[]>(filtered);
  const hasLinks = links.length > 0;

  useEffect(() => {
    setLinks(filtered);
  }, [filtered]);

  useEffect(() => {
    if (!profileId) return;
    const channel = supabase
      .channel(`public-links-${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profile_links", filter: `profile_id=eq.${profileId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as ProfileLinkRecord;
            if (!row.is_active) return;
            setLinks((prev) => dedupe([...prev, row]).sort(byOrder));
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as ProfileLinkRecord;
            setLinks((prev) => {
              const next = prev.slice();
              const idx = next.findIndex((item) => item.id === row.id);
              if (!row.is_active) {
                if (idx !== -1) next.splice(idx, 1);
              } else {
                if (idx !== -1) next[idx] = row;
                else next.push(row);
              }
              return next.sort(byOrder);
            });
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as ProfileLinkRecord;
            setLinks((prev) => prev.filter((item) => item.id !== row.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  if (variant === "buttons") {
    return (
      <section className={cn("space-y-4", className)}>
        {!hasLinks ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Links will appear here as soon as they are published.
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center rounded-full border border-transparent bg-[color:var(--primary)] px-6 py-3 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-[0_18px_35px_-25px_var(--ring)] transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
                aria-label={`Open ${link.title}`}
                title={link.title}
              >
                {link.title}
              </a>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">Links</p>
        <h2 className="text-2xl font-semibold">What to explore</h2>
        <p className="text-sm text-[color:var(--muted-foreground)]">Tap any card to jump straight into the destinations they curated.</p>
      </div>

      {!hasLinks ? (
        <div
          className="rounded-2xl border p-6 text-sm text-[color:var(--muted-foreground)]"
          style={{
            background: appearance?.background,
            borderColor: appearance?.border,
          }}
        >
          Links will appear here as soon as they are published.
        </div>
      ) : (
        <ul className="space-y-3">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-4 rounded-2xl border px-4 py-3 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] hover:bg-[color:var(--link-hover)] hover:shadow-[0_14px_35px_-25px_var(--ring)]"
                style={{
                  background: appearance?.background,
                  borderColor: appearance?.border,
                  color: appearance?.text,
                  // @ts-expect-error -- custom property for hover utility
                  "--link-hover": appearance?.hover ?? "var(--muted)",
                }}
                aria-label={`Open ${link.title}`}
                title={link.title}
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[color:var(--muted)]/60">
                  <Image
                    src={apiFavicon(link.url) || ""}
                    alt=""
                    width={32}
                    height={32}
                    className="h-10 w-10 object-contain"
                    unoptimized
                    onError={(event) => {
                      const fallback = s2Favicon(link.url);
                      if (fallback) (event.currentTarget as HTMLImageElement).src = fallback;
                    }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{link.title}</div>
                  <div className="truncate text-xs text-[color:var(--muted-foreground)] group-hover:text-[color:var(--foreground)]/70">
                    {link.url}
                  </div>
                </div>
                <span className="hidden text-xs font-medium text-[color:var(--muted-foreground)] sm:block">Open</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function dedupe(list: ProfileLinkRecord[]): ProfileLinkRecord[] {
  const seen = new Set<string>();
  const out: ProfileLinkRecord[] = [];
  for (const item of list) {
    if (!seen.has(item.id)) {
      out.push(item);
      seen.add(item.id);
    }
  }
  return out;
}
