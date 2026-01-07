import { notFound } from "next/navigation";
import { getSignedAvatarUrl } from "@/lib/avatar-server";
import { getSignedProfileHeaderUrl } from "@/lib/profile-header-server";
import { normalizeLeadFormConfig } from "@/lib/lead-form";
import { getActiveProfileForPublicHandle } from "@/lib/profile-service";
import { createServerSupabase } from "@/lib/supabase/server";
import { isDarkTheme } from "@/lib/themes";
import type { ProfileLinkRecord } from "@/types/db";
import type { LeadFormConfig } from "@/types/lead-form";
import PublicProfileLinksList from "@/components/public/PublicProfileLinksList";
import PublicLeadForm from "@/components/public/PublicLeadForm";
import VCardDownload from "@/components/VCardDownload";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string }>;
};

function sortLinks(links: ProfileLinkRecord[] | null | undefined) {
  return (links ?? [])
    .filter((link) => link.is_active)
    .slice()
    .sort(
      (a, b) =>
        (a.order_index ?? 0) - (b.order_index ?? 0) ||
        a.created_at.localeCompare(b.created_at)
    );
}

export default async function PublicProfilePage({ params }: Props) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle?.trim().toLowerCase();
  if (!handle) notFound();

  const payload = await getActiveProfileForPublicHandle(handle);
  if (!payload) notFound();

  const { account, profile } = payload;
  const avatar = await getSignedAvatarUrl(
    account.avatar_url,
    account.avatar_updated_at
  );
  const headerImage = await getSignedProfileHeaderUrl(
    profile.header_image_url,
    profile.header_image_updated_at
  );
  const publicHandle = account.username || profile.handle || handle;
  const supabase = await createServerSupabase();
  const { data: leadFormRow } = await supabase
    .from("lead_forms")
    .select("id, config")
    .eq("handle", publicHandle)
    .eq("status", "published")
    .maybeSingle();
  const leadFormTitle = leadFormRow?.config
    ? normalizeLeadFormConfig(
        leadFormRow.config as LeadFormConfig,
        leadFormRow.id ?? `form-${publicHandle}`
      ).title
    : "Contact";
  const displayName = profile.name || account.display_name || publicHandle;
  const isDark = isDarkTheme(profile.theme);
  const themeClass = `theme-${profile.theme} ${isDark ? "dark" : ""}`;
  const headline = profile.headline?.trim() ?? "";
  const links = sortLinks(profile.links);
  const hasLinks = links.length > 0;
  const hasHeadline = Boolean(headline);

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

        <main className="relative mx-auto w-full max-w-5xl px-4 pb-20 pt-16 sm:px-8 sm:pt-24 lg:px-10">
          <section className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="space-y-6">
              <div className="sm:hidden">
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
                  <div className="-mt-16 flex flex-col items-center px-4 pb-4 text-center">
                    <div
                      className={`h-28 w-28 overflow-hidden rounded-3xl border-4 border-background shadow-sm relative z-10 ${
                        avatar ? "bg-muted/40" : "bg-background"
                      }`}
                    >
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
                    <div className="mt-3 space-y-1">
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
              <div className="hidden flex-wrap items-center gap-4 sm:flex">
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
                    <PublicProfileLinksList links={links} trackClicks />
                  </div>
                ) : null}
            </div>

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
          </section>
        </main>
      </div>
    </div>
  );
}
