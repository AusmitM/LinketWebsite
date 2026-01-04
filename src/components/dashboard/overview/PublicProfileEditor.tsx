"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Copy, Link as LinkIcon, Trash2 } from "lucide-react";

import AvatarUploader from "@/components/dashboard/AvatarUploader";
import LeadFormBuilder from "@/components/dashboard/LeadFormBuilder";
import VCardContent from "@/components/dashboard/vcard/VCardContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { buildAvatarPublicUrl } from "@/lib/avatar-utils";
import { toast } from "@/components/system/toaster";
import type { ThemeName } from "@/lib/themes";
import type { ProfileWithLinks } from "@/lib/profile-service";

type LinkItem = {
  id: string;
  label: string;
  url: string;
};

type ProfileDraft = {
  id: string;
  name: string;
  handle: string;
  headline: string;
  links: LinkItem[];
  theme: ThemeName;
  active: boolean;
  updatedAt: string;
};

export default function PublicProfileEditor() {
  const dashboardUser = useDashboardUser();
  const { theme } = useThemeOptional();
  const [userId, setUserId] = useState<string | null>(
    dashboardUser?.id ?? null
  );
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [savedProfile, setSavedProfile] = useState<ProfileDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [accountHandle, setAccountHandle] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosavePending = useRef(false);

  useEffect(() => {
    if (dashboardUser?.id) {
      setUserId(dashboardUser.id);
    }
  }, [dashboardUser]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/account/handle?userId=${encodeURIComponent(userId)}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("Unable to load account");
        const payload = (await response.json()) as {
          handle?: string | null;
          avatarPath?: string | null;
          avatarUpdatedAt?: string | null;
        };
        if (cancelled) return;
        setAccountHandle(payload.handle ?? null);
        setAvatarUrl(
          buildAvatarPublicUrl(
            payload.avatarPath ?? null,
            payload.avatarUpdatedAt ?? null
          )
        );
      } catch {
        if (!cancelled) {
          setAccountHandle(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/linket-profiles?userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const info = await res.json().catch(() => ({}));
        throw new Error(info?.error || "Unable to load profile");
      }
      const data = (await res.json()) as ProfileWithLinks[];
      if (!data.length) {
        const handle = accountHandle ?? `user-${userId.slice(0, 8)}`;
        const payload = {
          name: "Linket Public Profile",
          handle,
          headline: "",
          links: [{ title: "Website", url: "https://" }],
          theme,
          active: true,
        };
        const createRes = await fetch("/api/linket-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, profile: payload }),
        });
        if (!createRes.ok) {
          const info = await createRes.json().catch(() => ({}));
          throw new Error(info?.error || "Unable to create profile");
        }
        const created = mapProfile((await createRes.json()) as ProfileWithLinks);
        setDraft(created);
        setSavedProfile(created);
        setLoading(false);
        return;
      }
      const active = data.find((profile) => profile.is_active) ?? data[0];
      const mapped = mapProfile(active);
      setDraft(mapped);
      setSavedProfile(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load profile";
      toast({
        title: "Profile unavailable",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, accountHandle, theme]);

  useEffect(() => {
    if (!userId) return;
    void loadProfile();
  }, [userId, loadProfile]);

  useEffect(() => {
    if (!draft) return;
    if (draft.theme === theme) return;
    setDraft((prev) =>
      prev ? { ...prev, theme, updatedAt: new Date().toISOString() } : prev
    );
  }, [theme, draft]);

  const isDirty = useMemo(() => {
    if (!draft || !savedProfile) return false;
    return JSON.stringify(draft) !== JSON.stringify(savedProfile);
  }, [draft, savedProfile]);

  const handleSave = useCallback(async () => {
    if (!draft || !userId) return;
    if (saving) {
      autosavePending.current = true;
      return;
    }
    autosavePending.current = false;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        id: draft.id?.trim() ? draft.id : undefined,
        name: draft.name,
        handle: draft.handle,
        headline: draft.headline,
        theme: draft.theme,
        links: draft.links.map((link) => ({
          id: link.id,
          title: link.label,
          url: link.url,
        })),
        active: true,
      };
      const res = await fetch("/api/linket-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, profile: payload }),
      });
      if (!res.ok) {
        const info = await res.json().catch(() => ({}));
        throw new Error(info?.error || "Unable to save profile");
      }
      const saved = mapProfile((await res.json()) as ProfileWithLinks);
      setDraft(saved);
      setSavedProfile(saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save profile";
      setSaveError(message);
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [draft, userId, saving]);

  useEffect(() => {
    if (!saving && autosavePending.current && draft && isDirty && userId) {
      autosavePending.current = false;
      void handleSave();
    }
  }, [saving, draft, isDirty, userId, handleSave]);

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
      void handleSave();
    }, 900);
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [draft, isDirty, userId, handleSave]);

  const profileUrl = useMemo(() => {
    const handle = draft?.handle || accountHandle;
    if (!handle) return null;
    const envBase = process.env.NEXT_PUBLIC_SITE_URL;
    const base =
      envBase && envBase.length > 0
        ? envBase
        : typeof window !== "undefined"
        ? window.location.origin
        : "https://linketconnect.com";
    const normalized = base.replace(/\/$/, "");
    return `${normalized}/${encodeURIComponent(handle)}`;
  }, [accountHandle, draft?.handle]);

  const buildFallbackDraft = useCallback((): ProfileDraft | null => {
    if (!userId) return null;
    const now = new Date().toISOString();
    const fallbackHandle = accountHandle ?? `user-${userId.slice(0, 8)}`;
    return {
      id: "",
      name: "",
      handle: fallbackHandle,
      headline: "",
      links: [
        {
          id: `link-${cryptoRandom()}`,
          label: "Website",
          url: "https://",
        },
      ],
      theme,
      active: true,
      updatedAt: now,
    };
  }, [userId, accountHandle, theme]);

  const updateDraft = useCallback(
    (patch: Partial<ProfileDraft>) => {
      setSaveError(null);
      setDraft((prev) => {
        if (prev) {
          return { ...prev, ...patch, updatedAt: new Date().toISOString() };
        }
        const base = buildFallbackDraft();
        if (!base) return prev;
        setSavedProfile(base);
        return { ...base, ...patch, updatedAt: new Date().toISOString() };
      });
    },
    [buildFallbackDraft]
  );

  const copyProfileUrl = useCallback(async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast({ title: "Link copied" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to copy the link";
      toast({ title: "Copy failed", description: message, variant: "destructive" });
    }
  }, [profileUrl]);

  const updateLink = useCallback((linkId: string, patch: Partial<LinkItem>) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            links: prev.links.map((link) =>
              link.id === linkId ? { ...link, ...patch } : link
            ),
            updatedAt: new Date().toISOString(),
          }
        : prev
    );
  }, []);

  const addLink = useCallback(() => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            links: [
              ...prev.links,
              {
                id: `link-${cryptoRandom()}`,
                label: "New link",
                url: "https://",
              },
            ],
            updatedAt: new Date().toISOString(),
          }
        : prev
    );
  }, []);

  const removeLink = useCallback((linkId: string) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            links: prev.links.filter((link) => link.id !== linkId),
            updatedAt: new Date().toISOString(),
          }
        : prev
    );
  }, []);

  const inputsDisabled = !userId;

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Public profile
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={copyProfileUrl}
              disabled={!profileUrl}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
            {profileUrl ? (
              <Button asChild size="sm" className="rounded-full">
                <Link href={profileUrl} target="_blank" rel="noreferrer">
                  View public profile
                </Link>
              </Button>
            ) : (
              <Button size="sm" className="rounded-full" disabled>
                View public profile
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:items-start">
          <div className="min-w-0 max-w-[360px]">
            {userId ? (
              <AvatarUploader
                userId={userId}
                avatarUrl={avatarUrl}
                onUploaded={({ publicUrl }) => setAvatarUrl(publicUrl)}
                variant="compact"
              />
            ) : (
              <div className="h-20 rounded-2xl border border-dashed border-border/60 bg-muted/30" />
            )}
          </div>
          <div className="min-w-0 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-xs text-muted-foreground">
                Display name
              </Label>
              <Input
                id="profile-name"
                value={draft?.name ?? ""}
                onChange={(event) => updateDraft({ name: event.target.value })}
                disabled={inputsDisabled}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-headline" className="text-xs text-muted-foreground">
                Headline
              </Label>
              <Textarea
                id="profile-headline"
                rows={2}
                value={draft?.headline ?? ""}
                onChange={(event) => updateDraft({ headline: event.target.value })}
                disabled={inputsDisabled}
                placeholder="Engineer, founder, creative..."
                className="min-h-16 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-handle" className="text-xs text-muted-foreground">
                Public handle
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  linketconnect.com/
                </span>
                <Input
                  id="profile-handle"
                  value={draft?.handle ?? ""}
                  onChange={(event) =>
                    updateDraft({
                      handle: event.target.value.replace(/\s+/g, "").toLowerCase(),
                    })
                  }
                  className="h-9 pl-40 text-sm"
                  disabled={inputsDisabled}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Short, lowercase username with no spaces.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            {saveError
              ? `Save failed: ${saveError}`
              : saving
              ? "Saving changes..."
              : isDirty
              ? "Changes save automatically"
              : "All changes saved"}
          </span>
          <div className="inline-flex items-center gap-2">
            <LinkIcon className="h-3 w-3" aria-hidden />
            <span className="truncate">{profileUrl ?? "Public URL pending"}</span>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-foreground">Links</div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={addLink}
            disabled={inputsDisabled}
          >
            Add link
          </Button>
        </div>
        <div className="space-y-2">
          {draft?.links.map((link) => (
            <div key={link.id} className="rounded-xl border border-border/60 bg-background/60 p-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={link.label}
                  placeholder="Label"
                  onChange={(event) =>
                    updateLink(link.id, { label: event.target.value })
                  }
                  disabled={inputsDisabled}
                  className="h-9 text-sm"
                />
                <Input
                  value={link.url}
                  placeholder="https://"
                  onChange={(event) =>
                    updateLink(link.id, { url: event.target.value })
                  }
                  disabled={inputsDisabled}
                  className="h-9 text-sm"
                />
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-muted-foreground"
                  onClick={() => removeLink(link.id)}
                  disabled={inputsDisabled || (draft?.links.length ?? 0) <= 1}
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Remove
                </Button>
              </div>
            </div>
          ))}
          {draft?.links.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
              No links yet.
            </div>
          )}
        </div>
      </section>

      {userId ? (
        <div className="grid gap-4 lg:grid-cols-2 items-start">
          <LeadFormBuilder
            userId={userId}
            handle={accountHandle || draft?.handle || null}
            variant="compact"
          />
          <VCardContent variant="embedded" />
        </div>
      ) : null}
    </div>
  );
}

function cryptoRandom() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (
      (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
      Math.random().toString(36).slice(2, 10)
    );
  }
  return Math.random().toString(36).slice(2, 10);
}

function mapProfile(record: ProfileWithLinks): ProfileDraft {
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
    theme: record.theme as ThemeName,
    active: record.is_active,
    updatedAt: record.updated_at,
  };
}
