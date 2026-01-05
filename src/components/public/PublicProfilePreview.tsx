"use client";

import { buildAvatarPublicUrl } from "@/lib/avatar-utils";
import { isDarkTheme } from "@/lib/themes";
import type { ProfileWithLinks } from "@/lib/profile-service";
import PublicProfileLinksList from "@/components/public/PublicProfileLinksList";
import PublicLeadForm from "@/components/public/PublicLeadForm";
import VCardDownload from "@/components/VCardDownload";

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
}: Props) {
  const avatar = buildAvatarPublicUrl(
    account.avatarPath,
    account.avatarUpdatedAt
  );
  const publicHandle = account.handle || profile.handle || handle;
  const displayName = profile.name || account.displayName || publicHandle;
  const isDark = isDarkTheme(profile.theme);
  const themeClass = `theme-${profile.theme} ${isDark ? "dark" : ""}`;
  const headline = profile.headline?.trim() ?? "";
  const links = sortLinks(profile.links);
  const hasLinks = links.length > 0;
  const hasHeadline = Boolean(headline);

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
          <main className="relative mx-auto w-full max-w-3xl px-6 pb-20 pt-12 sm:px-10">
            <section className="space-y-8">
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
                    {hasHeadline ? (
                      <p className="text-sm text-muted-foreground">
                        {headline}
                      </p>
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
              </div>

              {hasLinks ? (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    Links
                  </h2>
                  <PublicProfileLinksList links={links} />
                </div>
              ) : null}

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
        ) : (
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
                    {hasHeadline ? (
                      <p className="text-sm text-muted-foreground">
                        {headline}
                      </p>
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

                {hasLinks ? (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      Links
                    </h2>
                    <PublicProfileLinksList links={links} />
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
        )}
      </div>
    </div>
  );
}
