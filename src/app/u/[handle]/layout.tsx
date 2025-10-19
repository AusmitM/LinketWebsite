import type { ReactNode } from "react";
import { getActiveProfileForPublicHandle } from "@/lib/profile-service";
import { inlineCssForTheme } from "@/lib/themes";

export const revalidate = 60;

type Params = { handle: string };

export default async function PublicHandleLayout(props: { children: ReactNode; params: Promise<Params> }) {
  const params = await props.params;
  const handle = params.handle;

  let theme = process.env.NEXT_PUBLIC_PUBLIC_DEFAULT_THEME || "dark";
  try {
    const result = await getActiveProfileForPublicHandle(handle);
    const profileTheme = result?.profile?.theme;
    if (profileTheme) {
      theme = profileTheme;
    }
  } catch {
    // ignore and keep default theme
  }

  const themeClass = `theme-${theme}${theme === "dark" ? " dark" : ""}`;
  const css = inlineCssForTheme(theme);

  return (
    <div className={themeClass}>
      {/* Override root tokens for this route to ensure header/footer match too */}
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: css }} />
      <div className="bg-[var(--background)] text-[var(--foreground)]">
        {props.children}
      </div>
    </div>
  );
}
