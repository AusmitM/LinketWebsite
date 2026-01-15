"use client";

import { useEffect, useState } from "react";
import { getSignedAvatarUrl } from "@/lib/avatar-client";
import { getSignedProfileHeaderUrl } from "@/lib/profile-header-client";
import { isDarkTheme } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";
import type { ProfileWithLinks } from "@/lib/profile-service";
import type { LeadFormConfig } from "@/types/lead-form";
import PublicProfileLinksList from "@/components/public/PublicProfileLinksList";
import PublicLeadForm from "@/components/public/PublicLeadForm";
import VCardDownload from "@/components/VCardDownload";
import ShareContactButton from "@/components/ShareContactButton";

type AccountPreview = {
  handle: string;
  displayName: string | null;
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
};

type Props = {
  profile: ProfileWithLinks;
  account: AccountPreview;
  handle: string;
  layout?: "split" | "stacked";
  forceMobile?: boolean;
  themeOverride?: ThemeName;
};

function sortLinks(links: ProfileWithLinks["links"]) {
  return (links ?? [])
    .filter((link) => link.is_active)
    .slice()
    .sort(
      (a, b) =>
        (a.order_index ?? 0) - (b.order_index ?? 0) ||
        a.created_at.localeCompare(b.created_at)
    );
}

export default function PublicProfilePreview({
  profile,
  account,
  handle,
  layout = "split",
  forceMobile = false,
  themeOverride,
}: Props) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const publicHandle = account.handle || profile.handle || handle;
  const displayName = profile.name || account.displayName || publicHandle;
  const resolvedTheme = themeOverride ?? profile.theme;
  const isDark = isDarkTheme(resolvedTheme);
  const themeClass = `theme-${resolvedTheme} ${isDark ? "dark" : ""}`;
  const headline = profile.headline?.trim() ?? "";
  const links = sortLinks(profile.links);
  const hasLinks = links.length > 0;
  const hasHeadline = Boolean(headline);
  const [leadFormTitle, setLeadFormTitle] = useState("Contact");
  const [hasLeadForm, setHasLeadForm] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const signed = await getSignedAvatarUrl(
        account.avatarPath,
        account.avatarUpdatedAt
      );
      if (!active) return;
      setAvatar(signed);
    })();
    return () => {
      active = false;
    };
  }, [account.avatarPath, account.avatarUpdatedAt]);

  useEffect(() => {
    let active = true;
    (async () => {
      const signed = await getSignedProfileHeaderUrl(
        profile.header_image_url,
        profile.header_image_updated_at
      );
      if (!active) return;
      setHeaderImage(signed);
    })();
    return () => {
      active = false;
    };
  }, [profile.header_image_url, profile.header_image_updated_at]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(
          `/api/lead-forms/public?handle=${encodeURIComponent(publicHandle)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          form: LeadFormConfig | null;
        };
        if (!active) return;
        const fields = payload.form?.fields ?? [];
        setHasLeadForm(fields.length > 0);
        if (payload.form?.title) {
          setLeadFormTitle(payload.form.title);
        }
      } catch {
        if (active) setLeadFormTitle("Contact");
      }
    })();
    return () => {
      active = false;
    };
  }, [publicHandle]);

  return (
    <div className={`min-h-full bg-background text-foreground ${themeClass}`}>
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

        {layout === "stacked" ? (
          <main className="relative mx-auto w-full max-w-3xl px-4 pb-20 pt-12 sm:px-8 lg:px-10">
            <section className="space-y-8">
              <div className="space-y-6">
              <div className={forceMobile ? "" : "sm:hidden"}>
                <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/70">
                  <div className="relative h-32">
                    {headerImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={headerImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-r from-[#7C4DA0] via-[#B26A85] to-[#E1A37B]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />
                  </div>
                  <div
                    className={
                      avatar
                        ? "-mt-16 flex flex-col items-center px-4 pb-4 text-center"
                        : "mt-4 flex flex-col items-center px-4 pb-6 text-center"
                    }
                  >
                    {avatar ? (
                      <div className="h-28 w-28 overflow-hidden rounded-3xl border-4 border-[var(--avatar-border)] shadow-sm relative z-10 bg-muted/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatar}
                          alt={`${displayName} avatar`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className={avatar ? "mt-3 space-y-1" : "mt-2 space-y-1"}>
                      <h1 className="break-words font-display text-2xl tracking-tight">
                        {displayName}
                      </h1>
                      {hasHeadline ? (
                        <p className="break-words text-sm text-muted-foreground">
                          {headline}
                        </p>
                      ) : null}
                      <div className="break-words text-xs text-muted-foreground">
                        @{publicHandle}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {forceMobile ? null : (
              <div className="hidden flex-wrap items-center gap-4 sm:flex">
                {avatar ? (
                  <div className="h-20 w-20 overflow-hidden rounded-3xl border-4 border-[var(--avatar-border)] bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatar}
                      alt={`${displayName} avatar`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                  <div className="min-w-0 space-y-1">
                    <h1 className="break-words font-display text-3xl tracking-tight sm:text-4xl">
                      {displayName}
                    </h1>
                    {hasHeadline ? (
                      <p className="break-words text-sm text-muted-foreground">
                        {headline}
                      </p>
                    ) : null}
                    <div className="break-words text-xs text-muted-foreground">
                      @{publicHandle}
                    </div>
                  </div>
                </div>
              )}

                <div
                  className={
                    forceMobile
                      ? "flex flex-wrap items-center justify-center gap-3"
                      : "flex flex-wrap items-center justify-center gap-3 sm:justify-start"
                  }
                >
                  <VCardDownload
                    handle={publicHandle}
                    label="Download contact information"
                    className="w-full rounded-full bg-foreground text-background shadow-[0_16px_32px_-24px_rgba(15,23,42,0.6)] hover:bg-foreground/90 sm:w-auto"
                  />
                  <ShareContactButton
                    handle={publicHandle}
                    label="Share contact"
                    variant="outline"
                    className="w-full rounded-full sm:w-auto"
                  />
                </div>
              </div>

              {hasLinks ? (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    Links
                  </h2>
                  <PublicProfileLinksList links={links} />
                </div>
              ) : null}

              {hasLeadForm ? (
                <div className="rounded-[28px] border border-border/60 bg-card/80 p-6 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.7)]">
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-foreground">
                      {leadFormTitle}
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
                      showHeader={false}
                    />
                  </div>
                </div>
              ) : null}
            </section>
          </main>
        ) : (
          <main className="relative mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-8 lg:px-10">
            <section className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="space-y-6">
              <div className={forceMobile ? "" : "sm:hidden"}>
                <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/70">
                  <div className="relative h-32">
                    {headerImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={headerImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-r from-[#e6a639] via-[#6cdadd] to-[#53bede]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />
                  </div>
                  <div
                    className={
                      avatar
                        ? "-mt-16 flex flex-col items-center px-4 pb-4 text-center"
                        : "mt-4 flex flex-col items-center px-4 pb-6 text-center"
                    }
                  >
                    {avatar ? (
                      <div className="h-28 w-28 overflow-hidden rounded-3xl border-4 border-[var(--avatar-border)] shadow-sm relative z-10 bg-muted/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatar}
                          alt={`${displayName} avatar`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className={avatar ? "mt-3 space-y-1" : "mt-2 space-y-1"}>
                      <h1 className="break-words font-display text-2xl tracking-tight">
                        {displayName}
                      </h1>
                      {hasHeadline ? (
                        <p className="break-words text-sm text-muted-foreground">
                          {headline}
                        </p>
                      ) : null}
                      <div className="break-words text-xs text-muted-foreground">
                        @{publicHandle}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {forceMobile ? null : (
              <div className="hidden flex-wrap items-center gap-4 sm:flex">
                {avatar ? (
                  <div className="h-20 w-20 overflow-hidden rounded-3xl border-4 border-[var(--avatar-border)] bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatar}
                      alt={`${displayName} avatar`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                  <div className="min-w-0 space-y-1">
                    <h1 className="break-words font-display text-3xl tracking-tight sm:text-4xl">
                      {displayName}
                    </h1>
                    {hasHeadline ? (
                      <p className="break-words text-sm text-muted-foreground">
                        {headline}
                      </p>
                    ) : null}
                    <div className="break-words text-xs text-muted-foreground">
                      @{publicHandle}
                    </div>
                  </div>
                </div>
              )}

                {forceMobile ? null : (
                <div className="flex flex-wrap items-center gap-3">
                  <VCardDownload
                    handle={publicHandle}
                    label="Download contact information"
                    className="w-full rounded-full bg-foreground text-background shadow-[0_16px_32px_-24px_rgba(15,23,42,0.6)] hover:bg-foreground/90 sm:w-auto"
                  />
                  <ShareContactButton
                    handle={publicHandle}
                    label="Share contact"
                    variant="outline"
                    className="w-full rounded-full sm:w-auto"
                  />
                </div>
                )}

                {!forceMobile && hasLinks ? (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      Links
                    </h2>
                    <PublicProfileLinksList links={links} />
                  </div>
                ) : null}
              </div>

              {hasLeadForm ? (
                <div className="rounded-[28px] border border-border/60 bg-card/80 p-6 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.7)]">
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-foreground">
                      {leadFormTitle}
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
                      showHeader={false}
                    />
                  </div>
                </div>
              ) : null}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
