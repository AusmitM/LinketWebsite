"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Tags } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/system/toaster";
import { supabase } from "@/lib/supabase";
import AvatarUploader from "@/components/dashboard/AvatarUploader";
import { buildAvatarPublicUrl } from "@/lib/avatar-utils";
import type { ThemeName } from "@/lib/themes";
import type { ProfileWithLinks } from "@/lib/profile-service";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";

const THEME_OPTIONS: Array<{
  id: ThemeName;
  label: string;
  description: string;
  preview: string;
  textTone: "light" | "dark";
}> = [
  {
    id: "light",
    label: "Light",
    description: "Bright + crisp with modern blue accents",
    preview: "linear-gradient(135deg, #f5f7fb 0%, #ffffff 100%)",
    textTone: "dark",
  },
  {
    id: "dark",
    label: "Dark",
    description: "Cool twilight navy with electric blues",
    preview: "linear-gradient(135deg, #121826 0%, #1a2237 100%)",
    textTone: "light",
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Deep violet night with neon glow",
    preview: "linear-gradient(135deg, #050414 0%, #1b1542 100%)",
    textTone: "light",
  },
  {
    id: "forest",
    label: "Forest",
    description: "Verdant greens inspired by lush canopies",
    preview: "linear-gradient(135deg, #0f2418 0%, #1f4230 100%)",
    textTone: "light",
  },
  {
    id: "gilded",
    label: "Gilded",
    description: "Velvet black with molten gold accents",
    preview: "linear-gradient(135deg, #050505 0%, #171008 45%, #d4af37 120%)",
    textTone: "light",
  },
  {
    id: "silver",
    label: "Silver",
    description: "Polished graphite with soft steel highlights",
    preview: "linear-gradient(135deg, #f5f7f8 0%, #d9dee7 100%)",
    textTone: "dark",
  },
  {
    id: "autumn",
    label: "Autumn",
    description: "Warm amber and spice for fall launches",
    preview: "linear-gradient(135deg, #fff0e0 0%, #f6b97a 100%)",
    textTone: "dark",
  },
];

const DEFAULT_THEME: ThemeName = "light";

type LinkItem = {
  id: string;
  label: string;
  url: string;
};

type LinketProfile = {
  id: string;
  name: string;
  handle: string;
  headline: string;
  links: LinkItem[];
  theme: ThemeName;
  active: boolean;
  updatedAt: string;
};

export default function ProfilesContent() {
  const dashboardUser = useDashboardUser();
  const [userId, setUserId] = useState<string | null>(dashboardUser?.id ?? null);
  const [authLoading, setAuthLoading] = useState(!dashboardUser);
  const [profiles, setProfiles] = useState<LinketProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LinketProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [accountHandle, setAccountHandle] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosavePending = useRef(false);

  useEffect(() => {
    if (dashboardUser?.id) {
      setUserId(dashboardUser.id);
      setAuthLoading(false);
    }
  }, [dashboardUser]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUserId(data.user?.id ?? null);
      setAuthLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadProfiles = useCallback(
    async (focusId?: string) => {
      if (!userId) {
        setProfiles([]);
        setSelectedId(null);
        setDraft(null);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/linket-profiles?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load profiles (${res.status})`);
        const raw = (await res.json()) as ProfileWithLinks[];
        const data = raw.map(mapProfile);
        setProfiles(data);
        window.dispatchEvent(new CustomEvent("linket-profiles:updated"));
        if (data.length === 0) {
          setSelectedId(null);
          setDraft(null);
          return;
        }
        const active = data.find((p) => p.active);
        const nextId = focusId ?? active?.id ?? data[0].id;
        setSelectedId(nextId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load profiles";
        toast({ title: "Load failed", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (authLoading) return;
    void loadProfiles();
  }, [authLoading, loadProfiles]);

  useEffect(() => {
    if (!userId) {
      setAvatarUrl(null);
      setAccountHandle(null);
      setAccountError(null);
      setAccountLoading(false);
      return;
    }

    let cancelled = false;
    setAccountLoading(true);
    setAccountError(null);

    (async () => {
      try {
        const response = await fetch(`/api/account/handle?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
        if (!response.ok) {
          const info = await response.json().catch(() => ({}));
          throw new Error((info?.error as string) || `Unable to load account (${response.status})`);
        }
        const payload = (await response.json()) as {
          handle?: string | null;
          avatarPath?: string | null;
          avatarUpdatedAt?: string | null;
        };
        if (cancelled) return;
        setAvatarUrl(buildAvatarPublicUrl(payload.avatarPath ?? null, payload.avatarUpdatedAt ?? null));
        setAccountHandle(payload.handle ?? null);
        setAccountError(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load account";
        setAccountError(message);
      } finally {
        if (!cancelled) {
          setAccountLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    setConfirmDelete(false);
    if (!selectedId) {
      setDraft(null);
      return;
    }
    const current = profiles.find((profile) => profile.id === selectedId);
    setDraft(current ? structuredCloneProfile(current) : null);
    setAutoSaveError(null);
  }, [profiles, selectedId]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return profiles.find((profile) => profile.id === selectedId) ?? null;
  }, [profiles, selectedId]);

  const activeProfile = useMemo(() => {
    return profiles.find((profile) => profile.active) ?? null;
  }, [profiles]);

  const isDirty = useMemo(() => {
    if (!selected || !draft) return false;
    return JSON.stringify(selected) !== JSON.stringify(draft);
  }, [draft, selected]);

  const draftTheme = draft?.theme ?? DEFAULT_THEME;
  const currentThemeOption = useMemo(() => {
    return THEME_OPTIONS.find((option) => option.id === draftTheme) ?? THEME_OPTIONS[0];
  }, [draftTheme]);
  const nextThemeOption = useMemo(() => {
    const currentIndex = THEME_OPTIONS.findIndex((option) => option.id === draftTheme);
    const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
    return THEME_OPTIONS[nextIndex];
  }, [draftTheme]);

  function updateDraft(patch: Partial<LinketProfile>) {
    setAutoSaveError(null);
    setDraft((prev) => (prev ? { ...prev, ...patch, updatedAt: new Date().toISOString() } : prev));
  }

  function updateLink(linkId: string, patch: Partial<LinkItem>) {
    setAutoSaveError(null);
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            links: prev.links.map((link) => (link.id === linkId ? { ...link, ...patch } : link)),
            updatedAt: new Date().toISOString(),
          }
        : prev
    );
  }

  function addLink() {
    setAutoSaveError(null);
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            links: [...prev.links, { id: `link-${cryptoRandom()}`, label: "New link", url: "https://" }],
            updatedAt: new Date().toISOString(),
          }
        : prev
    );
  }

  function removeLink(linkId: string) {
    setAutoSaveError(null);
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            links: prev.links.filter((link) => link.id !== linkId),
            updatedAt: new Date().toISOString(),
          }
        : prev
    );
  }

  async function handleAddProfile() {
    if (!userId) {
      toast({ title: "Not signed in", description: "Log in to create a profile.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: "New profile",
        handle: `profile-${profiles.length + 1}`,
        headline: "",
        links: [{ title: "Website", url: "https://" }],
        theme: DEFAULT_THEME,
        active: profiles.length === 0,
      };
      const res = await fetch("/api/linket-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, profile: payload }),
      });
      if (!res.ok) {
        const info = await res.json().catch(() => ({}));
        throw new Error((info?.error as string) || "Unable to create profile");
      }
      const saved = mapProfile((await res.json()) as ProfileWithLinks);
      toast({ title: "Profile created", description: `${saved.name} ready to edit.` });
      await loadProfiles(saved.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create profile";
      toast({ title: "Create failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const handleSave = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!draft) return;
      if (!userId) {
        toast({ title: "Not signed in", description: "Log in to save profiles.", variant: "destructive" });
        return;
      }
      if (saving) {
        if (options?.quiet) {
          autosavePending.current = true;
        }
        return;
      }
      autosavePending.current = false;
      setSaving(true);
      try {
        const payload = {
          id: draft.id,
          name: draft.name,
          handle: draft.handle,
          headline: draft.headline,
          theme: draft.theme,
          links: draft.links.map((link) => ({ id: link.id, title: link.label, url: link.url })),
          active: draft.active,
        };
        const res = await fetch("/api/linket-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, profile: payload }),
        });
        if (!res.ok) {
          const info = await res.json().catch(() => ({}));
          throw new Error((info?.error as string) || "Unable to save profile");
        }
        const saved = mapProfile((await res.json()) as ProfileWithLinks);
        setAutoSaveError(null);
        if (!options?.quiet) {
          toast({ title: "Profile saved", description: `${saved.name} updated.` });
        }
        await loadProfiles(saved.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save profile";
        setAutoSaveError(`Save failed: ${message}`);
        if (!options?.quiet) {
          toast({ title: "Save failed", description: message, variant: "destructive" });
        }
      } finally {
        setSaving(false);
      }
    },
    [draft, userId, saving, loadProfiles]
  );

  async function handleDelete() {
    if (!draft) return;
    if (!userId) {
      toast({ title: "Not signed in", description: "Log in to delete profiles.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/linket-profiles/${draft.id}?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const info = await res.json().catch(() => ({}));
        throw new Error((info?.error as string) || "Unable to delete profile");
      }
      toast({ title: "Profile deleted", description: `${draft.name} removed.` });
      await loadProfiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete profile";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive() {
    if (!draft) return;
    if (!userId) {
      toast({ title: "Not signed in", description: "Log in to manage active profile.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/linket-profiles/${draft.id}/activate?userId=${encodeURIComponent(userId)}`, {
        method: "POST",
      });
      if (!res.ok) {
        const info = await res.json().catch(() => ({}));
        throw new Error((info?.error as string) || "Unable to activate profile");
      }
      const saved = mapProfile((await res.json()) as ProfileWithLinks);
      toast({ title: "Linket updated", description: `${saved.name} is now active.` });
      await loadProfiles(saved.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to activate profile";
      toast({ title: "Action failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleCycleTheme() {
    if (!draft || inputsDisabled) return;
    const currentIndex = THEME_OPTIONS.findIndex((option) => option.id === draft.theme);
    const nextOption = THEME_OPTIONS[(currentIndex + 1) % THEME_OPTIONS.length];
    updateDraft({ theme: nextOption.id });
  }

  useEffect(() => {
    if (!draft || !isDirty || !userId) {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      return;
    }

    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }

    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void handleSave({ quiet: true });
    }, 1200);

    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [draft, isDirty, userId, handleSave]);

  useEffect(() => {
    if (!saving && autosavePending.current && draft && isDirty) {
      autosavePending.current = false;
      void handleSave({ quiet: true });
    }
  }, [saving, draft, isDirty, handleSave]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  const saveStatusMessage = useMemo(() => {
    if (accountLoading) return "Loading...";
    if (accountError) return accountError;
    if (autoSaveError) return autoSaveError;
    if (saving) return "Saving changes...";
    if (isDirty) return "Changes will save automatically";
    return "All changes saved";
  }, [accountLoading, accountError, autoSaveError, saving, isDirty]);

  const hasAutoSaveError = Boolean(autoSaveError);
  const inputsDisabled = loading || accountLoading || saving || !userId;

  const effectiveHandle = accountHandle ?? draft?.handle ?? activeProfile?.handle ?? null;
  const publicProfileUrl = useMemo(() => {
    if (!effectiveHandle) return null;
    const envBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    if (envBase) return `${envBase}/u/${effectiveHandle}`;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/u/${effectiveHandle}`;
    }
    return `/u/${effectiveHandle}`;
  }, [effectiveHandle]);

  const copyPublicProfileUrl = useCallback(async () => {
    if (!publicProfileUrl) return;
    try {
      await navigator.clipboard.writeText(publicProfileUrl);
      toast({ title: "Link copied", description: publicProfileUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to copy";
      toast({ title: "Copy failed", description: message, variant: "destructive" });
    }
  }, [publicProfileUrl]);

  const lastUpdatedDisplay = useMemo(() => {
    if (!draft?.updatedAt) return "Not saved yet";
    try {
      const date = new Date(draft.updatedAt);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    } catch {
      return draft.updatedAt;
    }
  }, [draft?.updatedAt]);

  // const hasStatusError = Boolean(accountError || autoSaveError);

  if (authLoading) {
    return (
      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Linket Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Checking your account...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!userId) {
    return (
      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Linket Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Sign in to create and manage profiles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border bg-card/80 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">Linket Profiles</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create tailored landing pages and choose which one your NFC tag opens.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {publicProfileUrl && (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={publicProfileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> View public profile
              </Link>
            </Button>
          )}
          <Button variant="secondary" size="sm" className="rounded-full" onClick={handleAddProfile} disabled={saving}>
            Add profile
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-2">
          {loading && profiles.length === 0 ? (
            <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Loading profiles...
            </p>
          ) : profiles.length === 0 ? (
            <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No profiles yet. Add your first Linket profile.
            </p>
          ) : (
            profiles.map((profile) => {
              const isSelected = profile.id === selectedId;
              const themeOption = THEME_OPTIONS.find((option) => option.id === profile.theme);
              const themeChipStyle = themeOption?.preview ? { background: themeOption.preview } : undefined;
              const themeChipText = themeOption?.textTone === "light" ? "text-white" : "text-slate-700";
              const updatedDisplay = (() => {
                try {
                  const date = new Date(profile.updatedAt);
                  if (Number.isNaN(date.valueOf())) return "Unknown";
                  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
                } catch {
                  return "Unknown";
                }
              })();

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setSelectedId(profile.id)}
                  className={`group w-full rounded-2xl border px-3 py-3 text-left transition shadow-sm ${
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/20"
                      : "border-border hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span className="text-muted-foreground">@{profile.handle}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm ${themeChipText}`}
                      style={themeChipStyle}
                    >
                      <span className="h-2.5 w-2.5 rounded-full border border-white/30 bg-white/60" />
                      {themeOption?.label ?? profile.theme}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{profile.name}</div>
                      <p className="text-xs text-muted-foreground">
                        {profile.links.length} link{profile.links.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    {profile.active && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Updated {updatedDisplay}
                  </p>
                </button>
              );
            })
          )}
        </aside>

        {draft ? (
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase text-muted-foreground" htmlFor="profile-name">
                    Profile name
                  </label>
                  <Input
                    id="profile-name"
                    value={draft.name}
                    onChange={(event) => updateDraft({ name: event.target.value })}
                    disabled={inputsDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase text-muted-foreground" htmlFor="profile-handle">
                    Handle
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      linket.co/u/
                    </span>
                    <Input
                      id="profile-handle"
                      value={draft.handle}
                      onChange={(event) => updateDraft({ handle: event.target.value })}
                      className="pl-28"
                      disabled={inputsDisabled}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase text-muted-foreground" htmlFor="profile-headline">
                  Headline
                </label>
                <Textarea
                  id="profile-headline"
                  rows={3}
                  placeholder="What should visitors learn first?"
                  value={draft.headline}
                  onChange={(event) => updateDraft({ headline: event.target.value })}
                  disabled={inputsDisabled}
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">Profile picture</span>
                <span className={`text-xs ${accountError ? "text-destructive" : "text-muted-foreground"}`}>
                  {accountError ?? "Shown on your public Linket page"}
                </span>
              </div>
              {accountLoading ? (
                <div className="h-32 w-full animate-pulse rounded-2xl border border-dashed border-muted" />
              ) : userId ? (
                <AvatarUploader
                  userId={userId}
                  avatarUrl={avatarUrl}
                  onUploaded={({ publicUrl }) => {
                    setAvatarUrl(publicUrl);
                    setAccountError(null);
                  }}
                />
              ) : null}
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card/80 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Public link</p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">
                      {publicProfileUrl ?? "Handle pending"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-full"
                      onClick={copyPublicProfileUrl}
                      disabled={!publicProfileUrl}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy
                    </Button>
                    {publicProfileUrl && (
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <Link href={publicProfileUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Share this URL on cards, socials, or in your email signature.
                </p>
              </div>
              <div className="rounded-2xl border bg-card/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Snapshot</p>
                <div className="mt-2 space-y-2 text-sm text-foreground">
                  <div className="flex items-center justify-between">
                    <span>Theme</span>
                    <span className="font-medium">{currentThemeOption.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Links</span>
                    <span>{draft.links.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Last updated</span>
                    <span>{lastUpdatedDisplay}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Theme</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Click to cycle</span>
              </div>
              <button
                type="button"
                onClick={handleCycleTheme}
                disabled={inputsDisabled}
                className={`flex w-full flex-col gap-2 rounded-2xl border border-border/60 p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  currentThemeOption.textTone === "light" ? "text-white shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)]" : "text-foreground"
                }`}
                style={{ background: currentThemeOption.preview }}
              >
                <span
                  className={`text-sm font-semibold leading-tight ${
                    currentThemeOption.textTone === "light" ? "text-white" : "text-foreground"
                  }`}
                >
                  {currentThemeOption.label}
                </span>
                <span
                  className={`text-xs ${
                    currentThemeOption.textTone === "light" ? "text-white/80" : "text-muted-foreground"
                  }`}
                >
                  {currentThemeOption.description}
                </span>
                <span
                  className={`text-xs font-medium ${
                    currentThemeOption.textTone === "light" ? "text-white/70" : "text-muted-foreground"
                  }`}
                >
                  Next: {nextThemeOption.label}
                </span>
              </button>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Links</span>
                <Button variant="ghost" size="sm" className="rounded-full" onClick={addLink} disabled={inputsDisabled}>
                  Add link
                </Button>
              </div>
              <div className="space-y-3">
                {draft.links.map((link) => (
                  <div key={link.id} className="rounded-2xl border p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={link.label}
                        placeholder="Label"
                        onChange={(event) => updateLink(link.id, { label: event.target.value })}
                      />
                      <Input
                        value={link.url}
                        placeholder="https://"
                        onChange={(event) => updateLink(link.id, { url: event.target.value })}
                      />
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        onClick={() => removeLink(link.id)}
                        disabled={draft.links.length === 1}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                {draft.links.length === 0 && (
                  <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    No links yet. Add one to complete this profile.
                  </p>
                )}
              </div>
            </section>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Active profile is where your NFC tag redirects.</p>
                <Button
                  type="button"
                  className="rounded-full"
                  variant={draft.active ? "default" : "secondary"}
                  onClick={handleSetActive}
                  disabled={draft.active || saving}
                >
                  {draft.active ? "Currently active" : "Set as active profile"}
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {hasAutoSaveError ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-destructive">{saveStatusMessage}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => handleSave({ quiet: true })}
                      disabled={saving}
                    >
                      Retry save
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">{saveStatusMessage}</span>
                )}
                <div className="flex items-center gap-2">
                  {confirmDelete ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Delete this profile?</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-full"
                        onClick={handleDelete}
                        disabled={saving || profiles.length === 1}
                      >
                        Yes, delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setConfirmDelete(false)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setConfirmDelete(true)}
                      disabled={saving || profiles.length === 1}
                    >
                      Delete profile
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : loading ? (
          <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Loading profile...
          </p>
        ) : (
          <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Create your first Linket profile to get started.
          </p>
        )}
      </CardContent>
    </Card>

      <Card className="border border-dashed border-border/60 bg-muted/20">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Tags className="h-4 w-4" />
              Manage Linkets
            </CardTitle>
            <CardDescription>
              Need to claim a new Linket or reassign an existing one? Open the Linkets tab to manage every tag connected to your account.
            </CardDescription>
          </div>
          <Button asChild className="w-full rounded-full sm:w-auto">
            <Link href="/dashboard/linkets">Open Linkets</Link>
          </Button>
        </CardHeader>
      </Card>
    </div>
  );
}

function cryptoRandom() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
  }
  return Math.random().toString(36).slice(2, 10);
}

function structuredCloneProfile<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function mapProfile(record: ProfileWithLinks): LinketProfile {
  const links = (record.links ?? []).map((link, index) => ({
    id: link.id ?? `link-${index}`,
    label: link.title,
    url: link.url,
  }));
  return {
    id: record.id,
    name: record.name,
    handle: record.handle,
    headline: record.headline ?? "",
    links,
    theme: (record.theme as ThemeName) ?? DEFAULT_THEME,
    active: record.is_active,
    updatedAt: record.updated_at,
  };
}
