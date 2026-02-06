import { notFound } from "next/navigation";
import { getSignedAvatarUrl } from "@/lib/avatar-server";
import { getSignedProfileHeaderUrl } from "@/lib/profile-header-server";
import { getSignedProfileLogoUrl } from "@/lib/profile-logo-server";
import { normalizeLeadFormConfig } from "@/lib/lead-form";
import { getActiveProfileForPublicHandle } from "@/lib/profile-service";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { isDarkTheme } from "@/lib/themes";
import type { ProfileLinkRecord } from "@/types/db";
import type { LeadFormConfig } from "@/types/lead-form";
import PublicProfileLinksList from "@/components/public/PublicProfileLinksList";
import PublicProfileLiteMode from "@/components/public/PublicProfileLiteMode";
import PublicLeadForm from "@/components/public/PublicLeadForm";
import VCardDownload from "@/components/VCardDownload";
import ShareContactButton from "@/components/ShareContactButton";

export const revalidate = 60;

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
  const logoUrl = await getSignedProfileLogoUrl(
    profile.logo_url,
    profile.logo_updated_at
  );
  const logoShape = profile.logo_shape === "rect" ? "rect" : "circle";
  const logoBadgeClass = profile.logo_bg_white ? "bg-white" : "bg-background";
  const publicHandle = profile.handle || handle;
  let leadFormRow: { id: string; config: LeadFormConfig | null; status?: string } | null =
    null;
  const supabase = await createServerSupabaseReadonly();
  const { data } = await supabase
    .from("lead_forms")
    .select("id, config, status")
    .eq("handle", publicHandle)
    .eq("status", "published")
    .maybeSingle();
  leadFormRow = (data as { id: string; config: LeadFormConfig | null; status?: string } | null) ?? null;

  const normalizedLeadForm = leadFormRow?.config
    ? normalizeLeadFormConfig(
        leadFormRow.config as LeadFormConfig,
        leadFormRow.id ?? `form-${publicHandle}`
      )
    : null;
  const leadFormTitle = normalizedLeadForm?.title ?? "Contact";
  const hasLeadForm = Boolean(normalizedLeadForm?.fields?.length);
  const displayName = profile.name || account.display_name || publicHandle;
  const isDark = isDarkTheme(profile.theme);
  const themeClass = `theme-${profile.theme} ${isDark ? "dark" : ""}`;
  const headline = profile.headline?.trim() ?? "";
  const isBurntOrange = profile.theme === "burnt-orange";
  const links = sortLinks(profile.links);
  const hasLinks = links.length > 0;
  const hasHeadline = Boolean(headline);

  return (
    <div className={`public-profile-shell min-h-screen text-foreground ${themeClass}`}>
      <PublicProfileLiteMode />
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 public-profile-heavy">
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

        <section className="relative mx-auto w-full max-w-5xl px-4 pb-20 pt-4 sm:px-8 sm:pt-24 lg:px-10">
          <section className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="space-y-6">
              <div className="sm:hidden">
                <div className="public-profile-card overflow-hidden rounded-3xl border border-border/60 bg-card/70">
                  <div
                    className="relative h-32"
                    style={{
                      backgroundImage:
                        "linear-gradient(90deg, var(--primary), var(--accent), var(--ring))",
                    }}
                  >
                    {headerImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={headerImage}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        className="public-profile-header-image h-full w-full object-cover"
                      />
                    ) : null}
                    <div className="public-profile-heavy absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />
                  </div>
                  <div
                    className={
                      avatar
                        ? "-mt-16 flex flex-col items-center px-4 pb-4 text-center"
                        : "mt-4 flex flex-col items-center px-4 pb-6 text-center"
                    }
                  >
                    {avatar ? (
                      <div className="flex flex-col items-center">
                        <div className="relative h-28 w-28 rounded-3xl shadow-sm z-10 bg-muted/40 overflow-visible">
                          <div className="h-full w-full overflow-hidden rounded-3xl ring-4 ring-[var(--avatar-border)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={avatar}
                              alt={`${displayName} avatar`}
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          {logoUrl && logoShape === "circle" ? (
                            <span className={`absolute -bottom-2 -right-2 h-12 w-12 overflow-hidden rounded-full border-2 border-[var(--avatar-border)] shadow-md ${logoBadgeClass}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                            </span>
                          ) : null}
                        </div>
                        {logoUrl && logoShape === "rect" ? (
                          <span className={`mt-2 h-8 w-20 overflow-hidden rounded-md border border-[var(--avatar-border)] shadow-sm ${logoBadgeClass}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className={avatar ? "mt-3 space-y-1" : "mt-2 space-y-1"}>
                      <h1 className="break-words font-display text-2xl tracking-tight">
                        {displayName}
                      </h1>
                      {hasHeadline ? (
                        <p
                          className="break-words text-sm text-muted-foreground"
                          style={{ whiteSpace: "normal", overflow: "visible", textOverflow: "clip" }}
                        >
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
              <div className="public-profile-desktop-header hidden flex-wrap items-center gap-4 sm:flex">
                {avatar ? (
                  <div className="flex flex-col items-center">
                    <div className="relative h-20 w-20 rounded-3xl bg-muted/40 overflow-visible">
                      <div className="h-full w-full overflow-hidden rounded-3xl ring-4 ring-[var(--avatar-border)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatar}
                          alt={`${displayName} avatar`}
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {logoUrl && logoShape === "circle" ? (
                        <span className={`absolute -bottom-1.5 -right-1.5 h-8 w-8 overflow-hidden rounded-full border-2 border-[var(--avatar-border)] shadow-md ${logoBadgeClass}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                        </span>
                      ) : null}
                    </div>
                    {logoUrl && logoShape === "rect" ? (
                      <span className={`mt-2 h-6 w-16 overflow-hidden rounded-md border border-[var(--avatar-border)] shadow-sm ${logoBadgeClass}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="min-w-0 space-y-1">
                  <h1
                    className={`break-words font-display text-3xl tracking-tight sm:text-4xl ${
                      isBurntOrange ? "sm:text-[#fff6ed]" : ""
                    }`}
                  >
                    {displayName}
                  </h1>
                  {hasHeadline ? (
                    <p
                      className={`break-words text-sm text-muted-foreground ${
                        isBurntOrange ? "sm:text-[rgba(255,246,237,0.82)]" : ""
                      }`}
                      style={{ whiteSpace: "normal", overflow: "visible", textOverflow: "clip" }}
                    >
                      {headline}
                    </p>
                  ) : null}
                  <div
                    className={`break-words text-xs text-muted-foreground ${
                      isBurntOrange ? "sm:text-[rgba(255,246,237,0.7)]" : ""
                    }`}
                  >
                    @{publicHandle}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <VCardDownload
                  handle={publicHandle}
                  label="Save Contact Information"
                  className="public-profile-cta-primary w-full rounded-full bg-background text-foreground hover:bg-muted/60 dark:bg-background dark:text-foreground dark:hover:text-foreground dark:hover:bg-muted/30 shadow-[0_16px_32px_-24px_rgba(15,23,42,0.6)] sm:w-auto"
                />
                <ShareContactButton
                  handle={publicHandle}
                  label="Share contact"
                  variant="outline"
                  className="w-full rounded-full sm:w-auto"
                />
              </div>

                {hasLinks ? (
                  <div className="space-y-3">
                    <h2 className="public-profile-links-label text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      Links
                    </h2>
                    <PublicProfileLinksList links={links} trackClicks />
                  </div>
                ) : null}
            </div>

            {hasLeadForm ? (
              <div
                id="public-lead-form"
                className="public-profile-card rounded-[28px] border border-border/60 bg-card/80 p-6 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.7)]"
              >
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
        </section>
      </div>
    </div>
  );
}
