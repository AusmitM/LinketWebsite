import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ProfileLinkRecord } from "@/types/db";
import type { ThemeName } from "@/lib/themes";
import { getActiveProfileForPublicHandle } from "@/lib/profile-service";
import { buildAvatarPublicUrl } from "@/lib/avatar-utils";
import ProfileActions from "@/components/public/ProfileActions";
import PublicLinks from "@/components/public/PublicLinks";
import PublicLeadForm from "@/components/public/PublicLeadForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { handle: string };
type LayoutProps = { params: Promise<Params> };

type ThemeToken = `theme-${string}`;

const THEME_CLASS_MAP: Record<ThemeName, ThemeToken> = {
  light: "theme-light",
  dark: "theme-dark",
  midnight: "theme-midnight",
  forest: "theme-forest",
  gilded: "theme-gilded",
  silver: "theme-silver",
  autumn: "theme-autumn",
};

const DARK_THEMES = new Set<ThemeName>(["dark", "midnight", "forest", "gilded"]);
const FALLBACK_THEME: ThemeToken = "theme-light";

function resolveTheme(theme: ThemeName | null | undefined): ThemeToken {
  return (theme && THEME_CLASS_MAP[theme]) || FALLBACK_THEME;
}

const LINK_APPEARANCE = {
  background: "var(--card)",
  border: "var(--border)",
  text: "var(--foreground)",
  muted: "var(--muted-foreground)",
  hover: "var(--accent)",
} as const;

const FORM_APPEARANCE = {
  cardBackground: "var(--card)",
  cardBorder: "var(--border)",
  text: "var(--foreground)",
  muted: "var(--muted-foreground)",
  buttonVariant: "default" as const,
};

export default async function PublicHandle({ params }: LayoutProps) {
  const { handle } = await params;

  const result = await getActiveProfileForPublicHandle(handle);
  if (!result) {
    notFound();
  }

  const { account, profile } = result;
  const publicHandle = account.username;
  const avatarUrl = buildAvatarPublicUrl(account.avatar_url ?? null, account.avatar_updated_at ?? null);

  const themeClass = resolveTheme(profile.theme as ThemeName);
  const darkClass = DARK_THEMES.has(profile.theme) ? "dark" : undefined;

  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";
  const profileUrl = `${base}/u/${encodeURIComponent(publicHandle)}`;

  const links: ProfileLinkRecord[] = profile.links.map((link, index) => ({
    id: link.id,
    profile_id: profile.id,
    user_id: profile.user_id,
    title: link.title,
    url: link.url,
    order_index: link.order_index ?? index,
    is_active: link.is_active ?? true,
    created_at: link.created_at ?? profile.updated_at,
    updated_at: link.updated_at ?? null,
  }));

  const initialLetter = profile.name?.[0]?.toUpperCase() ?? "U";

  return (
    <div className={cn("min-h-screen", themeClass, darkClass)}>
      <div className="relative isolate min-h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
        <div
          className="pointer-events-none absolute inset-0 -z-20 opacity-70"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 20% -10%, color-mix(in srgb, var(--accent) 65%, transparent) 0%, transparent 55%), radial-gradient(circle at 80% 0%, color-mix(in srgb, var(--primary) 60%, transparent) 0%, transparent 50%), linear-gradient(145deg, color-mix(in srgb, var(--primary) 20%, transparent) 0%, transparent 65%)",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-to-b from-white/40 via-white/5 to-transparent mix-blend-soft-light" aria-hidden />

        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-4 pb-20 pt-16 sm:px-8 lg:px-12">
          <header className="rounded-3xl border border-[color:var(--border)]/70 bg-[color:var(--card)]/85 p-6 shadow-[0_35px_90px_-45px_var(--ring)] backdrop-blur-xl sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                <div className="relative inline-flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-[color:var(--muted)] text-3xl font-semibold text-[color:var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                  {avatarUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarUrl} alt={`${profile.name ?? publicHandle} avatar`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 rounded-full ring-1 ring-white/50" aria-hidden />
                    </>
                  ) : (
                    <>
                      {initialLetter}
                      <div
                        className="absolute inset-0 -z-10 rounded-full"
                        aria-hidden
                        style={{ background: "radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--primary) 35%, transparent) 0%, transparent 60%)" }}
                      />
                    </>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.45em] text-[color:var(--muted-foreground)]">Linket Profile</p>
                  <div className="space-y-2">
                    <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{profile.name}</h1>
                    {profile.headline && (
                      <p className="max-w-xl text-sm text-[color:var(--muted-foreground)] sm:text-base">{profile.headline}</p>
                    )}
                  </div>
                </div>
              </div>
              <ProfileActions className="md:w-auto" username={publicHandle} profileUrl={profileUrl} />
            </div>
          </header>

          <main className="grid flex-1 gap-8 lg:grid-cols-5">
            <section className="lg:col-span-3">
              <div className="rounded-3xl border border-[color:var(--border)]/70 bg-[color:var(--card)]/80 p-6 shadow-[0_28px_80px_-50px_var(--ring)] backdrop-blur-xl sm:p-8">
                <PublicLinks className="space-y-5" profileId={profile.id} initial={links} appearance={LINK_APPEARANCE} />
              </div>
            </section>
            <aside className="lg:col-span-2">
              <div className="rounded-3xl border border-[color:var(--border)]/70 bg-[color:var(--card)]/80 p-6 shadow-[0_28px_80px_-50px_var(--ring)] backdrop-blur-xl sm:p-8">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">Connect</p>
                  <h2 className="text-2xl font-semibold">Start a conversation</h2>
                </div>
                <div className="mt-6">
                  <PublicLeadForm ownerId={profile.user_id} handle={publicHandle} appearance={FORM_APPEARANCE} />
                </div>
              </div>
            </aside>
          </main>

          <footer className="pb-4 text-center text-xs text-[color:var(--muted-foreground)]">
            Powered by Linket
          </footer>
        </div>
      </div>
    </div>
  );
}
