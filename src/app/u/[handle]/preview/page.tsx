"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { buildAvatarPublicUrl } from "@/lib/avatar-utils";
import { isDarkTheme } from "@/lib/themes";
import type { ProfileWithLinks } from "@/lib/profile-service";
import PublicLeadForm from "@/components/public/PublicLeadForm";
import VCardDownload from "@/components/VCardDownload";

type PreviewState = {
  loading: boolean;
  error: string | null;
  profile: ProfileWithLinks | null;
  account: {
    handle: string;
    displayName: string | null;
    avatarPath: string | null;
    avatarUpdatedAt: string | null;
  } | null;
};

function faviconForUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return null;
    return `/api/favicon?u=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return null;
  }
}

export default function PublicProfilePreviewPage() {
  const params = useParams();
  const handle = String(params?.handle ?? "").trim().toLowerCase();
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<PreviewState>({
    loading: true,
    error: null,
    profile: null,
    account: null,
  });

  useEffect(() => {
    if (!handle) return;
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          throw new Error("Sign in to preview your profile.");
        }
        const userId = data.user.id;
        const profilesRes = await fetch(
          `/api/linket-profiles?userId=${encodeURIComponent(userId)}`,
          { cache: "no-store" }
        );
        if (!profilesRes.ok) {
          const info = await profilesRes.json().catch(() => ({}));
          throw new Error(info?.error || "Unable to load profiles.");
        }
        const profiles = (await profilesRes.json()) as ProfileWithLinks[];
        const profile =
          profiles.find(
            (item) => item.handle?.toLowerCase() === handle
          ) ?? profiles[0];
        if (!profile) throw new Error("Profile not found.");

        const accountRes = await fetch(
          `/api/account/handle?userId=${encodeURIComponent(userId)}`,
          { cache: "no-store" }
        );
        const accountPayload = accountRes.ok
          ? ((await accountRes.json()) as {
              handle?: string | null;
              displayName?: string | null;
              avatarPath?: string | null;
              avatarUpdatedAt?: string | null;
            })
          : null;

        if (!active) return;
        setState({
          loading: false,
          error: null,
          profile,
          account: {
            handle: accountPayload?.handle || profile.handle,
            displayName: accountPayload?.displayName ?? null,
            avatarPath: accountPayload?.avatarPath ?? null,
            avatarUpdatedAt: accountPayload?.avatarUpdatedAt ?? null,
          },
        });
      } catch (err) {
        if (!active) return;
        setState({
          loading: false,
          error: err instanceof Error ? err.message : "Unable to load preview.",
          profile: null,
          account: null,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [handle, supabase]);

  if (!handle) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-muted-foreground">
          Preview unavailable.
        </div>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-muted-foreground">
          Loading preview...
        </div>
      </div>
    );
  }

  if (state.error || !state.profile || !state.account) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-muted-foreground">
          {state.error ?? "Profile unavailable."}
        </div>
      </div>
    );
  }

  const { profile, account } = state;
  const avatar = buildAvatarPublicUrl(
    account.avatarPath,
    account.avatarUpdatedAt
  );
  const publicHandle = account.handle || profile.handle || handle;
  const displayName = profile.name || account.displayName || publicHandle;
  const isDark = isDarkTheme(profile.theme);
  const themeClass = `theme-${profile.theme} ${isDark ? "dark" : ""}`;
  const headline = profile.headline?.trim() ?? "";
  const links = (profile.links ?? [])
    .filter((link) => link.is_active)
    .slice()
    .sort(
      (a, b) =>
        (a.order_index ?? 0) - (b.order_index ?? 0) ||
        a.created_at.localeCompare(b.created_at)
    );

  return (
    <div className={`min-h-screen bg-background text-foreground ${themeClass}`}>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute -left-32 top-[-140px] h-[360px] w-[360px] rounded-full blur-[120px] opacity-20"
            style={{ backgroundColor: "var(--ring)" }}
          />
          <div
            className="absolute right-[-200px] top-[160px] h-[420px] w-[420px] rounded-full blur-[140px] opacity-15"
            style={{ backgroundColor: "var(--primary)" }}
          />
          <div
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--border) 1px, transparent 1px), linear-gradient(180deg, var(--border) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
            }}
          />
        </div>

        <main className="relative mx-auto w-full max-w-5xl px-6 pb-20 pt-12 sm:px-10">
          <section className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-3xl border border-border/60 bg-muted/40">
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt={`${displayName} avatar`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-foreground">
                      {displayName?.[0]?.toUpperCase() ?? "L"}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
                    {displayName}
                  </h1>
                  {headline ? (
                    <p className="text-sm text-muted-foreground">{headline}</p>
                  ) : null}
                  <div className="text-xs text-muted-foreground">
                    @{publicHandle}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <VCardDownload
                  handle={publicHandle}
                  label="Download contact information"
                  className="w-full rounded-full bg-foreground text-background shadow-[0_16px_32px_-24px_rgba(15,23,42,0.6)] hover:bg-foreground/90 sm:w-auto"
                />
              </div>

              {links.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    Links
                  </h2>
                  <div className="grid gap-3">
                    {links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
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
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-border/60 bg-card/80 p-6 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.7)]">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">
                  Contact
                </h2>
                <p className="text-sm text-muted-foreground">
                  Share your info with {displayName}.
                </p>
              </div>
              <div className="mt-5">
                <PublicLeadForm
                  ownerId={profile.user_id}
                  handle={publicHandle}
                  variant="profile"
                />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
