"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
} from "react";
import {
  Eye,
  EyeOff,
  Globe,
  GripVertical,
  IdCard,
  Instagram,
  Link2,
  MessageSquare,
  Palette,
  Pencil,
  Trash2,
  User,
  X,
} from "lucide-react";

import AvatarUploader from "@/components/dashboard/AvatarUploader";
import ProfileHeaderUploader from "@/components/dashboard/ProfileHeaderUploader";
import LeadFormBuilder from "@/components/dashboard/LeadFormBuilder";
import VCardContent from "@/components/dashboard/vcard/VCardContent";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { getSignedAvatarUrl } from "@/lib/avatar-client";
import { getSignedProfileHeaderUrl } from "@/lib/profile-header-client";
import { cn } from "@/lib/utils";
import { shuffleFields } from "@/lib/lead-form";
import { toast } from "@/components/system/toaster";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ThemeName } from "@/lib/themes";
import type { ProfileWithLinks } from "@/lib/profile-service";
import type { LeadFormConfig, LeadFormField } from "@/types/lead-form";

type SectionId = "profile" | "contact" | "links" | "lead";

type LinkIconKey = "instagram" | "globe" | "twitter" | "link";

type LinkItem = {
  id: string;
  label: string;
  url: string;
  icon: LinkIconKey;
  color: string;
  visible: boolean;
  clicks?: number;
};

type ProfileDraft = {
  id: string;
  name: string;
  handle: string;
  headline: string;
  headerImageUrl: string | null;
  headerImageUpdatedAt: string | null;
  links: LinkItem[];
  theme: ThemeName;
  active: boolean;
  updatedAt: string;
};

type VCardSnapshot = {
  email: string;
  phone: string;
  hasPhoto: boolean;
  status: "idle" | "saving" | "saved" | "error";
  isDirty: boolean;
  error: string | null;
};

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof User }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "contact", label: "Contact Card", icon: IdCard },
  { id: "links", label: "Links", icon: Link2 },
  { id: "lead", label: "Lead Form", icon: MessageSquare },
];

const ICON_OPTIONS: Array<{
  value: LinkIconKey;
  label: string;
  icon: typeof Instagram;
  color: string;
}> = [
  { value: "instagram", label: "Instagram", icon: Instagram, color: "#9B7CF5" },
  { value: "globe", label: "My Website", icon: Globe, color: "#55D88A" },
  { value: "twitter", label: "Twitter", icon: X, color: "#F1B16C" },
  { value: "link", label: "Link", icon: Link2, color: "#CBD5F5" },
];

const LINK_COLORS = [
  "#9B7CF5",
  "#55D88A",
  "#F1B16C",
  "#6AB7FF",
  "#F28AA0",
];

export default function PublicProfileEditorPage() {
  const dashboardUser = useDashboardUser();
  const { theme } = useThemeOptional();
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(dashboardUser?.id ?? null);
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [savedProfile, setSavedProfile] = useState<ProfileDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [accountHandle, setAccountHandle] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalMode, setLinkModalMode] = useState<"add" | "edit">("add");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState<LinkItem | null>(null);
  const [draggingLinkId, setDraggingLinkId] = useState<string | null>(null);
  const [leadFormPreview, setLeadFormPreview] = useState<LeadFormConfig | null>(
    null
  );
  const [vcardSnapshot, setVcardSnapshot] = useState<VCardSnapshot>({
    email: "",
    phone: "",
    hasPhoto: false,
    status: "idle",
    isDirty: false,
    error: null,
  });
  const [vcardLoaded, setVcardLoaded] = useState(false);
  const handleVCardFieldsChange = useCallback(
    (fields: { email: string; phone: string; photoData: string | null }) => {
      setVcardSnapshot((prev) => {
        const next = {
          ...prev,
          email: fields.email ?? "",
          phone: fields.phone ?? "",
          hasPhoto: Boolean(fields.photoData),
        };
        if (
          prev.email === next.email &&
          prev.phone === next.phone &&
          prev.hasPhoto === next.hasPhoto
        ) {
          return prev;
        }
        return next;
      });
    },
    []
  );
  const handleVCardStatusChange = useCallback(
    (payload: {
      status: "idle" | "saving" | "saved" | "error";
      isDirty: boolean;
      error: string | null;
    }) => {
      setVcardSnapshot((prev) => {
        const next = {
          ...prev,
          status: payload.status,
          isDirty: payload.isDirty,
          error: payload.error,
        };
        if (
          prev.status === next.status &&
          prev.isDirty === next.isDirty &&
          prev.error === next.error
        ) {
          return prev;
        }
        return next;
      });
    },
    []
  );

  const autosavePending = useRef(false);
  const leadFormLoadRef = useRef(0);
  const draftRef = useRef<ProfileDraft | null>(null);
  const reorderSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThemeRef = useRef<ThemeName | null>(null);
  const dragScrollFrame = useRef<number | null>(null);
  const leadFormReorderRef = useRef<
    ((sourceId: string, targetId: string) => void) | null
  >(null);

  useEffect(() => {
    if (!userId || vcardLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/vcard/profile?userId=${encodeURIComponent(userId)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          fields?: { email?: string; phone?: string };
        };
        if (cancelled) return;
        setVcardSnapshot((prev) => {
          if (prev.email || prev.phone) return prev;
          return {
            ...prev,
            email: payload.fields?.email ?? "",
            phone: payload.fields?.phone ?? "",
          };
        });
        setVcardLoaded(true);
      } catch {
        if (!cancelled) setVcardLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, vcardLoaded]);

  useEffect(() => {
    if (!draggingLinkId) return;

    const handleDragOver = (event: DragEvent) => {
      const viewportHeight = window.innerHeight || 0;
      if (!viewportHeight) return;
      const edge = 120;
      const y = event.clientY;
      let delta = 0;
      if (y < edge) {
        delta = -Math.min(24, Math.max(4, (edge - y) / 6));
      } else if (y > viewportHeight - edge) {
        delta = Math.min(24, Math.max(4, (y - (viewportHeight - edge)) / 6));
      }
      if (!delta) return;
      if (dragScrollFrame.current) return;
      dragScrollFrame.current = window.requestAnimationFrame(() => {
        window.scrollBy({ top: delta, left: 0, behavior: "auto" });
        dragScrollFrame.current = null;
      });
    };

    window.addEventListener("dragover", handleDragOver);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      if (dragScrollFrame.current) {
        window.cancelAnimationFrame(dragScrollFrame.current);
        dragScrollFrame.current = null;
      }
    };
  }, [draggingLinkId]);

  useEffect(() => {
    if (dashboardUser?.id) {
      setUserId(dashboardUser.id);
    }
  }, [dashboardUser]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
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
        if (!active) return;
        setAccountHandle(payload.handle ?? null);
        const signed = await getSignedAvatarUrl(
          payload.avatarPath ?? null,
          payload.avatarUpdatedAt ?? null
        );
        setAvatarUrl(signed);
      } catch {
        if (active) setAccountHandle(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!draft?.headerImageUrl) {
      setHeaderImageUrl(null);
      return;
    }
    let active = true;
    (async () => {
      const signed = await getSignedProfileHeaderUrl(
        draft.headerImageUrl,
        draft.headerImageUpdatedAt
      );
      if (!active) return;
      setHeaderImageUrl(signed);
    })();
    return () => {
      active = false;
    };
  }, [draft?.headerImageUrl, draft?.headerImageUpdatedAt]);

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
          links: [{ title: "Website", url: "https://www.linketconnect.com" }],
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
        setLastSavedAt(new Date().toISOString());
        setLoading(false);
        return;
      }
      const active = data.find((profile) => profile.is_active) ?? data[0];
      const mapped = mapProfile(active);
      setDraft(mapped);
      setSavedProfile(mapped);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load profile";
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

  useEffect(() => {
    return () => {
      if (themeSaveTimer.current) {
        clearTimeout(themeSaveTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const isDirty = useMemo(() => {
    if (!draft || !savedProfile) return false;
    return (
      JSON.stringify(normalizeDraftForCompare(draft)) !==
      JSON.stringify(normalizeDraftForCompare(savedProfile))
    );
  }, [draft, savedProfile]);

  const handleSave = useCallback(async (overrideDraft?: ProfileDraft) => {
    const draftSnapshot = overrideDraft ?? draft;
    if (!draftSnapshot || !userId) return;
    if (saving) {
      autosavePending.current = true;
      return;
    }
    const snapshotUpdatedAt = draftSnapshot.updatedAt;
    autosavePending.current = false;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        id: draftSnapshot.id?.trim() ? draftSnapshot.id : undefined,
        name: draftSnapshot.name,
        handle: draftSnapshot.handle,
        headline: draftSnapshot.headline,
        headerImageUrl: draftSnapshot.headerImageUrl,
        headerImageUpdatedAt: draftSnapshot.headerImageUpdatedAt,
        theme: draftSnapshot.theme,
        links: draftSnapshot.links.map((link) => ({
          id: link.id,
          title: link.label,
          url: link.url,
        })),
        active: draftSnapshot.active,
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
      const saved = mergeProfileUi(
        mapProfile((await res.json()) as ProfileWithLinks),
        draftSnapshot
      );
      setSavedProfile(saved);
      setLastSavedAt(new Date().toISOString());
      const currentDraft = draftRef.current;
      if (currentDraft?.updatedAt === snapshotUpdatedAt) {
        setDraft(saved);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to save profile";
      setSaveError(message);
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [draft, userId, saving]);

  useEffect(() => {
    if (!draft || !userId) return;
    if (lastThemeRef.current === null) {
      lastThemeRef.current = draft.theme;
      return;
    }
    if (draft.theme === lastThemeRef.current) return;
    lastThemeRef.current = draft.theme;
    if (themeSaveTimer.current) {
      clearTimeout(themeSaveTimer.current);
    }
    themeSaveTimer.current = setTimeout(() => {
      themeSaveTimer.current = null;
      if (!isDirty) return;
      void handleSave();
    }, 1000);
  }, [draft, handleSave, isDirty, userId]);

  useEffect(() => {
    if (!saving && autosavePending.current && draft && isDirty && userId) {
      autosavePending.current = false;
      void handleSave();
    }
  }, [saving, draft, isDirty, userId, handleSave]);

  const scheduleReorderSave = useCallback(() => {
    if (!userId) return;
    if (reorderSaveTimer.current) {
      clearTimeout(reorderSaveTimer.current);
    }
    reorderSaveTimer.current = setTimeout(() => {
      if (saving) {
        autosavePending.current = true;
        return;
      }
      if (!isDirty) return;
      void handleSave();
    }, 3000);
  }, [handleSave, isDirty, saving, userId]);

  useEffect(() => {
    return () => {
      if (reorderSaveTimer.current) {
        clearTimeout(reorderSaveTimer.current);
      }
    };
  }, []);

  const handleBlurCapture = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!isTextInput(target)) return;
      if (!isDirty || !userId) return;
      if (saving) return;
      void handleSave();
    },
    [handleSave, isDirty, saving, userId]
  );

  useEffect(() => {
    if (!userId) return;
    const handle = draft?.handle || accountHandle;
    if (!handle) {
      setLeadFormPreview(null);
      return;
    }
    const currentLoad = (leadFormLoadRef.current += 1);
    let active = true;
    (async () => {
      try {
        const response = await fetch(
          `/api/lead-forms?userId=${encodeURIComponent(
            userId
          )}&handle=${encodeURIComponent(handle)}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("Unable to load lead form");
        const payload = (await response.json()) as { form: LeadFormConfig };
        if (!active || currentLoad !== leadFormLoadRef.current) return;
        setLeadFormPreview(payload.form ?? null);
      } catch {
        if (active && currentLoad === leadFormLoadRef.current) {
          setLeadFormPreview(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [accountHandle, draft?.handle, userId]);

  const handleProfileChange = useCallback(
    (patch: Partial<ProfileDraft>) => {
      setSaveError(null);
      setDraft((prev) => {
        if (prev) {
          return { ...prev, ...patch, updatedAt: new Date().toISOString() };
        }
        const base = buildFallbackDraft(userId, accountHandle, theme);
        if (!base) return prev;
        setSavedProfile(base);
        return { ...base, ...patch, updatedAt: new Date().toISOString() };
      });
    },
    [userId, accountHandle, theme]
  );

  const updateLink = useCallback(
    (linkId: string, patch: Partial<LinkItem>) => {
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
    },
    []
  );

  const addLink = useCallback(() => {
    const newLink = createLink();
    setLinkForm(newLink);
    setEditingLinkId(null);
    setLinkModalMode("add");
    setLinkModalOpen(true);
  }, []);

  const removeLink = useCallback((linkId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const index = prev.links.findIndex((link) => link.id === linkId);
      if (index === -1) return prev;
      const removed = prev.links[index];
      const nextLinks = prev.links.filter((link) => link.id !== linkId);
      toast({
        title: "Link removed",
        description: "Undo",
        actionLabel: "Undo",
        onAction: () => {
          setDraft((current) =>
            current
              ? {
                  ...current,
                  links: insertAt(current.links, removed, index),
                  updatedAt: new Date().toISOString(),
                }
              : current
          );
        },
      });
      return {
        ...prev,
        links: nextLinks,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const reorderLinks = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const links = [...prev.links];
      const sourceIndex = links.findIndex((link) => link.id === sourceId);
      const targetIndex = links.findIndex((link) => link.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      const [moved] = links.splice(sourceIndex, 1);
      links.splice(targetIndex, 0, moved);
      return { ...prev, links, updatedAt: new Date().toISOString() };
    });
    scheduleReorderSave();
  }, [scheduleReorderSave]);

  const reorderLeadFormFields = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      setLeadFormPreview((prev) => {
        if (!prev) return prev;
        const fields = [...prev.fields];
        const sourceIndex = fields.findIndex((field) => field.id === sourceId);
        const targetIndex = fields.findIndex((field) => field.id === targetId);
        if (sourceIndex === -1 || targetIndex === -1) return prev;
        const [moved] = fields.splice(sourceIndex, 1);
        fields.splice(targetIndex, 0, moved);
        return { ...prev, fields };
      });
      leadFormReorderRef.current?.(sourceId, targetId);
    },
    []
  );

  const openEditLink = useCallback(
    (linkId: string) => {
      const link = draft?.links.find((item) => item.id === linkId);
      if (!link) return;
      setLinkForm(link);
      setEditingLinkId(linkId);
      setLinkModalMode("edit");
      setLinkModalOpen(true);
    },
    [draft?.links]
  );

  const saveLinkModal = useCallback(() => {
    if (!linkForm) return;
    if (linkModalMode === "add") {
      let nextDraft: ProfileDraft | null = null;
      setDraft((prev) => {
        if (!prev) return prev;
        const nextLinks = prev.links.some((link) => link.id === linkForm.id)
          ? prev.links.map((link) =>
              link.id === linkForm.id ? linkForm : link
            )
          : [...prev.links, linkForm];
        nextDraft = { ...prev, links: nextLinks, updatedAt: new Date().toISOString() };
        return nextDraft;
      });
      if (nextDraft) {
        void handleSave(nextDraft);
      }
    } else if (editingLinkId) {
      updateLink(editingLinkId, linkForm);
    }
    setLinkModalOpen(false);
  }, [editingLinkId, handleSave, linkForm, linkModalMode, updateLink]);

  const hasContactDetails = Boolean(
    vcardSnapshot.email?.trim() || vcardSnapshot.phone?.trim()
  );

  const saveState = saveError || vcardSnapshot.status === "error"
    ? "failed"
    : saving || vcardSnapshot.status === "saving"
    ? "saving"
    : "saved";

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as Window & {
      __linketProfileEditorState?: { hasUnsavedChanges: boolean; saveFailed: boolean };
    }).__linketProfileEditorState = {
      hasUnsavedChanges: Boolean(isDirty || vcardSnapshot.isDirty),
      saveFailed: Boolean(saveError || vcardSnapshot.status === "error"),
    };
    return () => {
      delete (window as Window & {
        __linketProfileEditorState?: { hasUnsavedChanges: boolean; saveFailed: boolean };
      }).__linketProfileEditorState;
    };
  }, [isDirty, vcardSnapshot.isDirty, saveError, vcardSnapshot.status]);

  const handleContactCta = useCallback(() => {
    if (!hasContactDetails) {
      setActiveSection("contact");
      const focusTarget = vcardSnapshot.email?.trim()
        ? "profile-contact-phone"
        : "profile-contact-email";
      requestFocus(focusTarget);
      return;
    }
    toast({
      title: "Save contact",
      description: "This will download your contact card on the live profile.",
    });
  }, [hasContactDetails, vcardSnapshot.email]);

  const handlePublish = useCallback(() => {
    handleProfileChange({ active: true });
    void handleSave();
  }, [handleProfileChange, handleSave]);

  const handleUnpublish = useCallback(() => {
    handleProfileChange({ active: false });
    void handleSave();
  }, [handleProfileChange, handleSave]);


  const profileDisplayName = draft?.name || "John Doe";
  const profileTagline =
    draft?.headline || "I do things | other things & mores";
  const isPublished = Boolean(draft?.active);

  return (
    <div className="space-y-6" onBlurCapture={handleBlurCapture}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {isPublished ? "Published" : "Draft"}
        </span>
        <span>
          Last saved: {lastSavedAt ? formatShortDate(lastSavedAt) : "Just now"}
        </span>
        {isDirty && <span className="text-amber-600">Unsaved changes</span>}
        {saveState === "failed" ? (
          <Button variant="outline" size="sm" onClick={() => void handleSave()}>
            Retry save
          </Button>
        ) : null}
        <Button size="sm" onClick={isPublished ? handleUnpublish : handlePublish}>
          {isPublished ? "Unpublish" : "Publish"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[550px_minmax(0,1fr)_50px]">
        <div className="space-y-4">
          <ProfileSectionsNav
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
          <EditorPanel
            activeSection={activeSection}
            draft={draft}
            loading={loading}
            userId={userId}
            avatarUrl={avatarUrl}
            accountHandle={accountHandle}
            headerImageUrl={headerImageUrl}
            onLeadFormPreview={setLeadFormPreview}
            onRegisterLeadFormReorder={(reorder) => {
              leadFormReorderRef.current = reorder;
            }}
            onAvatarUpdate={setAvatarUrl}
            onHeaderImageUpdate={(payload) => {
              const nextPath = payload.path || null;
              const nextUpdatedAt = payload.path ? payload.version : null;
              setHeaderImageUrl(payload.publicUrl || null);
              setLastSavedAt(payload.version);
              setDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      headerImageUrl: nextPath,
                      headerImageUpdatedAt: nextUpdatedAt,
                      updatedAt: payload.version,
                    }
                  : prev
              );
              setSavedProfile((prev) =>
                prev
                  ? {
                      ...prev,
                      headerImageUrl: nextPath,
                      headerImageUpdatedAt: nextUpdatedAt,
                      updatedAt: payload.version,
                    }
                  : prev
              );
            }}
            onProfileChange={handleProfileChange}
            onAddLink={addLink}
            onUpdateLink={updateLink}
            onEditLink={openEditLink}
            onRemoveLink={removeLink}
            onToggleLink={(linkId) =>
              updateLink(linkId, {
                visible: !draft?.links.find((link) => link.id === linkId)?.visible,
              })
            }
            onReorderLink={reorderLinks}
            draggingLinkId={draggingLinkId}
            setDraggingLinkId={setDraggingLinkId}
            onVCardFields={handleVCardFieldsChange}
            onVCardStatus={handleVCardStatusChange}
          />
        </div>
        <div className="flex justify-end self-start pt-0">
          <div className="origin-top-left scale-[1] -mt-2">
            <PhonePreviewCard
              profile={{ name: profileDisplayName, tagline: profileTagline }}
              avatarUrl={avatarUrl}
              headerImageUrl={headerImageUrl}
              contactEnabled={hasContactDetails}
              contactDisabledText="Add email or phone to enable Save contact"
              onContactClick={handleContactCta}
              links={draft?.links ?? []}
              leadFormPreview={leadFormPreview}
              onReorderLeadField={reorderLeadFormFields}
              onEditLink={openEditLink}
              onToggleLink={(linkId) =>
                updateLink(linkId, {
                  visible: !draft?.links.find((link) => link.id === linkId)?.visible,
                })
              }
              onRemoveLink={removeLink}
              onAddLink={addLink}
              onReorderLink={reorderLinks}
              draggingLinkId={draggingLinkId}
              setDraggingLinkId={setDraggingLinkId}
            />
          </div>
        </div>
      </div>

      <LinkModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        mode={linkModalMode}
        link={linkForm}
        onChange={setLinkForm}
        onSave={saveLinkModal}
      />
    </div>
  );
}

function ProfileSectionsNav({
  activeSection,
  onSectionChange,
}: {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="lg:hidden">
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Profile sections
        </label>
        <select
          value={activeSection}
          onChange={(event) => onSectionChange(event.target.value as SectionId)}
          className="mt-2 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
        >
          {SECTIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <aside className="hidden rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm lg:block">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          PROFILE SECTIONS
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            const iconClassName = item.id === "contact" ? "h-6 w-6" : "h-5 w-5";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-accent/60"
                )}
              >
                <Icon className={iconClassName} aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function EditorPanel({
  activeSection,
  draft,
  loading,
  userId,
  avatarUrl,
  accountHandle,
  headerImageUrl,
  onAvatarUpdate,
  onHeaderImageUpdate,
  onLeadFormPreview,
  onRegisterLeadFormReorder,
  onProfileChange,
  onAddLink,
  onUpdateLink,
  onEditLink,
  onRemoveLink,
  onToggleLink,
  onReorderLink,
  draggingLinkId,
  setDraggingLinkId,
  onVCardFields,
  onVCardStatus,
}: {
  activeSection: SectionId;
  draft: ProfileDraft | null;
  loading: boolean;
  userId: string | null;
  avatarUrl: string | null;
  accountHandle: string | null;
  headerImageUrl: string | null;
  onAvatarUpdate: (url: string) => void;
  onHeaderImageUpdate: (payload: { path: string; version: string; publicUrl: string }) => void;
  onLeadFormPreview: (preview: LeadFormConfig | null) => void;
  onRegisterLeadFormReorder: (
    reorder: ((sourceId: string, targetId: string) => void) | null
  ) => void;
  onProfileChange: (patch: Partial<ProfileDraft>) => void;
  onAddLink: () => void;
  onUpdateLink: (linkId: string, patch: Partial<LinkItem>) => void;
  onEditLink: (linkId: string) => void;
  onRemoveLink: (linkId: string) => void;
  onToggleLink: (linkId: string) => void;
  onReorderLink: (sourceId: string, targetId: string) => void;
  draggingLinkId: string | null;
  setDraggingLinkId: (id: string | null) => void;
  onVCardFields: (fields: {
    email: string;
    phone: string;
    photoData: string | null;
  }) => void;
  onVCardStatus: (payload: {
    status: "idle" | "saving" | "saved" | "error";
    isDirty: boolean;
    error: string | null;
  }) => void;
}) {
  const handleFieldsChange = useCallback(
    (fields: { email: string; phone: string; photoData: string | null }) => {
      onVCardFields({
        email: fields.email,
        phone: fields.phone,
        photoData: fields.photoData,
      });
    },
    [onVCardFields]
  );
  const handleStatusChange = useCallback(
    (payload: { status: "idle" | "saving" | "saved" | "error"; isDirty: boolean; error: string | null }) => {
      onVCardStatus({
        status: payload.status,
        isDirty: payload.isDirty,
        error: payload.error,
      });
    },
    [onVCardStatus]
  );
  if (activeSection === "profile") {
    return (
      <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Profile details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {userId ? (
            <AvatarUploader
              userId={userId}
              avatarUrl={avatarUrl}
              onUploaded={({ publicUrl }) => onAvatarUpdate(publicUrl)}
              variant="compact"
              inputId="profile-avatar-upload"
            />
          ) : (
            <div className="h-20 rounded-2xl border border-dashed border-border/60 bg-muted/30" />
          )}
          {userId && draft?.id ? (
            <ProfileHeaderUploader
              userId={userId}
              profileId={draft.id}
              headerUrl={headerImageUrl}
              onUploaded={onHeaderImageUpdate}
              variant="compact"
              inputId="profile-header-upload"
            />
          ) : (
            <div className="h-24 rounded-2xl border border-dashed border-border/60 bg-muted/30" />
          )}

          <div className="space-y-2">
            <Label htmlFor="profile-name" className="text-xs text-muted-foreground">
              Display name
            </Label>
            <Input
              id="profile-name"
              value={draft?.name ?? ""}
              onChange={(event) => onProfileChange({ name: event.target.value })}
              disabled={loading || !userId}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-headline" className="text-xs text-muted-foreground">
              Headline
            </Label>
            <Textarea
              id="profile-headline"
              rows={2}
              value={draft?.headline ?? ""}
              onChange={(event) =>
                onProfileChange({ headline: event.target.value })
              }
              disabled={loading || !userId}
              placeholder="I do things | other things & more things..."
              className="min-h-16 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-handle" className="text-xs text-muted-foreground">
              Public handle
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                linketconnect.com/
              </span>
              <Input
                id="profile-handle"
                value={draft?.handle ?? accountHandle ?? ""}
                onChange={(event) =>
                  onProfileChange({
                    handle: event.target.value.replace(/\s+/g, "").toLowerCase(),
                  })
                }
                className="h-9 pl-40 text-sm"
                disabled={loading || !userId}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

    if (activeSection === "contact") {
      return (
        <VCardContent
          variant="embedded"
          idPrefix="profile-contact"
          onFieldsChange={handleFieldsChange}
          onStatusChange={handleStatusChange}
        />
      );
    }

  if (activeSection === "links") {
    return (
      <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Links</CardTitle>
          <Button variant="ghost" size="sm" onClick={onAddLink}>
            Add link
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft?.links.map((link, index) => (
            <div
              key={link.id}
              className={cn(
                "group rounded-xl border border-border/60 bg-background/70 p-3",
                draggingLinkId === link.id && "opacity-70"
              )}
              draggable
              onDragStart={() => setDraggingLinkId(link.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingLinkId) {
                  onReorderLink(draggingLinkId, link.id);
                }
              }}
              onDragEnd={() => setDraggingLinkId(null)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <Input
                    id={`link-label-${index}`}
                    value={link.label}
                    placeholder="Label"
                    onChange={(event) =>
                      onUpdateLink(link.id, { label: event.target.value })
                    }
                    className="h-9 text-sm"
                  />
                    <Input
                      value={link.url}
                      placeholder="https://www."
                      onChange={(event) =>
                        onUpdateLink(link.id, { url: event.target.value })
                      }
                      className="h-9 text-sm"
                    />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEditLink(link.id)}
                    aria-label="Edit link"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onToggleLink(link.id)}
                    aria-label={link.visible ? "Hide link" : "Show link"}
                  >
                    {link.visible ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => onRemoveLink(link.id)}
                    aria-label="Delete link"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!draft?.links.length && (
            <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
              No links yet.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (activeSection === "lead") {
      return userId ? (
        <LeadFormBuilder
          userId={userId}
          handle={accountHandle || draft?.handle || null}
          profileId={draft?.id ?? null}
          onPreviewChange={onLeadFormPreview}
          showPreview={false}
          layout="stacked"
          onRegisterReorder={(reorder) => {
            onRegisterLeadFormReorder(reorder);
          }}
        />
    ) : (
      <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Sign in to edit the lead form.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Style</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        The public profile uses your dashboard theme automatically.
      </CardContent>
    </Card>
  );
}

function PhonePreviewCard({
  profile,
  avatarUrl,
  headerImageUrl,
  contactEnabled,
  contactDisabledText,
  onContactClick,
  links,
  leadFormPreview,
  onReorderLeadField,
  onEditLink,
  onToggleLink,
  onRemoveLink,
  onAddLink,
  onReorderLink,
  draggingLinkId,
  setDraggingLinkId,
}: {
  profile: { name: string; tagline: string };
  avatarUrl: string | null;
  headerImageUrl: string | null;
  contactEnabled: boolean;
  contactDisabledText: string;
  onContactClick: () => void;
  links: LinkItem[];
  leadFormPreview: LeadFormConfig | null;
  onReorderLeadField?: (sourceId: string, targetId: string) => void;
  onEditLink: (linkId: string) => void;
  onToggleLink: (linkId: string) => void;
  onRemoveLink: (linkId: string) => void;
  onAddLink: () => void;
  onReorderLink: (sourceId: string, targetId: string) => void;
  draggingLinkId: string | null;
  setDraggingLinkId: (id: string | null) => void;
}) {
  const visibleLinks = links.filter((link) => link.visible);
  const previewFields = leadFormPreview
    ? leadFormPreview.settings.shuffleQuestionOrder
      ? shuffleFields(leadFormPreview.fields)
      : leadFormPreview.fields
    : [];
  const submitLabel = "Submit";
  const [draggingLeadFieldId, setDraggingLeadFieldId] = useState<string | null>(
    null
  );

  return (
    <div className="h-fit w-full max-w-[340px] overflow-hidden rounded-[36px] border border-border/60 bg-background shadow-[0_20px_40px_-30px_rgba(15,23,42,0.3)]">
      <div className="relative h-28 rounded-t-[36px] bg-gradient-to-r from-[#e6a639] via-[#6cdadd] to-[#53bede]">
        {headerImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headerImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/20" />
      </div>
      <div className="flex flex-col items-center px-6 pb-6">
        <div className="-mt-16 h-28 w-28 overflow-hidden rounded-3xl border-4 border-[var(--avatar-border)] bg-background shadow-sm relative z-10">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-foreground">
              {profile.name?.[0]?.toUpperCase() ?? "L"}
            </span>
          )}
        </div>
        <div className="mt-3 text-center">
          <div className="mx-auto max-w-[240px] truncate text-base font-semibold text-foreground">
            {profile.name}
          </div>
          <div className="mx-auto mt-1 max-w-[240px] truncate text-xs text-muted-foreground">
            {profile.tagline}
          </div>
        </div>
        <button
          type="button"
          onClick={onContactClick}
          className={cn(
            "mt-4 w-full rounded-full px-4 py-2 text-xs font-semibold",
            contactEnabled
              ? "bg-[#D9ECFF] text-[#2E6AA5] hover:bg-[#C8E3FF]"
              : "bg-[#EEF3F9] text-[#7AA7D8] opacity-80"
          )}
        >
          <span className="block truncate">
            {contactEnabled ? "Save contact" : contactDisabledText}
          </span>
        </button>

        <div className="mt-4 w-full text-left">
          <div className="text-xs font-semibold text-muted-foreground">
            Links
          </div>
          <div className="mt-3 space-y-3">
            {visibleLinks.map((link) => (
              <LinkListItem
                key={link.id}
                link={link}
                onEdit={() => onEditLink(link.id)}
                onToggle={() => onToggleLink(link.id)}
                onRemove={() => onRemoveLink(link.id)}
                draggable
                onDragStart={() => setDraggingLinkId(link.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggingLinkId) {
                    onReorderLink(draggingLinkId, link.id);
                  }
                }}
                onDragEnd={() => setDraggingLinkId(null)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 w-full text-xs text-muted-foreground">
          {leadFormPreview?.title || "Get in Touch"}
        </div>
        <div className="mt-3 w-full space-y-2">
          {previewFields.length ? (
            previewFields.map((field) =>
              field.type === "section" ? (
                <div
                  key={field.id}
                  className="rounded-2xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                >
                  <div className="text-[11px] font-semibold">{field.title}</div>
                  {field.description ? (
                    <div className="mt-1 text-[10px]">{field.description}</div>
                  ) : null}
                </div>
              ) : (
                <div
                  key={field.id}
                  className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={() => setDraggingLeadFieldId(field.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingLeadFieldId) {
                      onReorderLeadField?.(draggingLeadFieldId, field.id);
                    }
                  }}
                  onDragEnd={() => setDraggingLeadFieldId(null)}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <div className="text-[10px] uppercase tracking-[0.2em]">
                      {field.label}
                      {field.required ? " *" : ""}
                    </div>
                  </div>
                  <PreviewLeadField field={field} />
                </div>
              )
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 px-3 py-3 text-center text-[11px] text-muted-foreground">
              Add lead form fields to see them here.
            </div>
          )}
          <button
            type="button"
            className="w-full rounded-full bg-foreground/90 px-4 py-2 text-xs font-semibold text-background"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewLeadField({ field }: { field: LeadFormField }) {
  switch (field.type) {
    case "short_text":
      return (
        <div className="mt-2 flex h-8 items-center rounded-xl border border-border/60 bg-muted/50 px-2 text-[11px] text-muted-foreground">
          {field.helpText || "Short answer"}
        </div>
      );
    case "long_text":
      return (
        <div className="mt-2 flex h-10 items-center rounded-xl border border-border/60 bg-muted/50 px-2 text-[11px] text-muted-foreground">
          {field.helpText || "Long answer"}
        </div>
      );
    case "dropdown":
      return (
        <div className="mt-2 flex h-8 items-center rounded-xl border border-border/60 bg-muted/50 px-2 text-[11px]">
          Select
        </div>
      );
    case "multiple_choice":
    case "checkboxes":
      return (
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className="h-3 w-3 rounded border border-border/60 bg-muted/50" />
          {field.options[0]?.label || "Option"}
        </div>
      );
    case "linear_scale":
      return (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          {field.min} - {field.max}
        </div>
      );
    case "rating":
      return (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          {Array.from({ length: field.scale }).map((_, index) => (
            <span key={index}>*</span>
          ))}
        </div>
      );
    case "date":
    case "time":
    case "short_text":
    case "file_upload":
    default:
      return (
        <div className="mt-2 h-8 rounded-xl border border-border/60 bg-muted/50" />
      );
  }
}

function faviconForUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return null;
    return `/api/favicon?u=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return null;
  }
}

function LinkListItem({
  link,
  onEdit,
  onToggle,
  onRemove,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  link: LinkItem;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}) {
  const Icon = ICON_OPTIONS.find((item) => item.value === link.icon)?.icon ?? Link2;
  const clicks = link.clicks ?? 0;
  const favicon = faviconForUrl(link.url);
  return (
    <div
      className="group relative flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3 text-xs font-medium shadow-[0_12px_24px_-18px_rgba(15,23,42,0.2)] cursor-grab active:cursor-grabbing"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </span>
        {favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={favicon}
            alt=""
            className="h-7 w-7 rounded"
            aria-hidden
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {link.label}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {link.url}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {clicks.toLocaleString()} clicks
          </div>
        </div>
      </div>
      <div className="absolute inset-2 hidden items-center justify-center gap-2 rounded-xl bg-background/90 text-[10px] font-semibold text-foreground shadow-[0_12px_24px_-18px_rgba(15,23,42,0.25)] group-hover:flex">
        <button type="button" onClick={onEdit} className="rounded-full px-2 py-1 hover:bg-muted">
          Edit
        </button>
        <button type="button" onClick={onToggle} className="rounded-full px-2 py-1 hover:bg-muted">
          {link.visible ? "Hide" : "Show"}
        </button>
        <button type="button" onClick={onRemove} className="rounded-full px-2 py-1 hover:bg-muted">
          Delete
        </button>
      </div>
    </div>
  );
}

function LinkModal({
  open,
  onOpenChange,
  mode,
  link,
  onChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  link: LinkItem | null;
  onChange: (link: LinkItem | null) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add link" : "Edit link"}</DialogTitle>
          <DialogDescription>Update the link details.</DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link-label">Label</Label>
              <Input
                id="link-label"
                value={link.label}
                onChange={(event) =>
                  onChange({ ...link, label: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                value={link.url}
                placeholder="https://www."
                onChange={(event) =>
                  onChange({ ...link, url: event.target.value })
                }
              />
            </div>
            {mode !== "add" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="link-icon">Icon</Label>
                  <select
                    id="link-icon"
                    value={link.icon}
                    onChange={(event) =>
                      onChange({
                        ...link,
                        icon: event.target.value as LinkIconKey,
                      })
                    }
                    className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                  >
                    {ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link-color">Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="link-color"
                      type="color"
                      value={link.color}
                      onChange={(event) =>
                        onChange({ ...link, color: event.target.value })
                      }
                      className="h-10 w-10 rounded-md border border-border/60 bg-background"
                    />
                    <div className="flex flex-wrap gap-2">
                      {LINK_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => onChange({ ...link, color })}
                          className="h-6 w-6 rounded-full border border-border/60"
                          style={{ backgroundColor: color }}
                          aria-label={`Set color ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                id="link-visible"
                type="checkbox"
                checked={link.visible}
                onChange={(event) =>
                  onChange({ ...link, visible: event.target.checked })
                }
              />
              <Label htmlFor="link-visible">Visible</Label>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            {mode === "add" ? "Add link" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildFallbackDraft(
  userId: string | null,
  accountHandle: string | null,
  theme: ThemeName
): ProfileDraft | null {
  if (!userId) return null;
  const now = new Date().toISOString();
  const fallbackHandle = accountHandle ?? `user-${userId.slice(0, 8)}`;
  return {
    id: "",
    name: "",
    handle: fallbackHandle,
    headline: "",
    headerImageUrl: null,
    headerImageUpdatedAt: null,
    links: [createLink()],
    theme,
    active: true,
    updatedAt: now,
  };
}

function createLink(): LinkItem {
  const base = ICON_OPTIONS[0];
  return {
    id: `link-${cryptoRandom()}`,
    label: "New link",
    url: "https://www.linketconnect.com",
    icon: base.value,
    color: base.color,
    visible: true,
    clicks: 0,
  };
}

function guessIcon(title: string, url: string): LinkIconKey {
  const raw = `${title} ${url}`.toLowerCase();
  if (raw.includes("instagram")) return "instagram";
  if (raw.includes("twitter") || raw.includes("x.com")) return "twitter";
  if (raw.includes("website") || raw.includes("http")) return "globe";
  return "link";
}

function mapProfile(record: ProfileWithLinks): ProfileDraft {
  const links = (record.links ?? []).map((link, index) => {
    const icon = guessIcon(link.title, link.url);
    const fallbackColor =
      ICON_OPTIONS.find((option) => option.value === icon)?.color ??
      LINK_COLORS[index % LINK_COLORS.length];
    return {
      id: link.id ?? `link-${index}`,
      label: link.title,
      url: link.url,
      icon,
      color: fallbackColor,
      visible: link.is_active ?? true,
      clicks: link.click_count ?? 0,
    };
  });
  return {
    id: record.id,
    name: record.name,
    handle: record.handle,
    headline: record.headline ?? "",
    headerImageUrl: record.header_image_url ?? null,
    headerImageUpdatedAt: record.header_image_updated_at ?? null,
    links,
    theme: record.theme as ThemeName,
    active: record.is_active,
    updatedAt: record.updated_at,
  };
}

function mergeProfileUi(next: ProfileDraft, previous: ProfileDraft | null) {
  if (!previous) return next;
  const uiById = new Map(
    previous.links.map((link) => [
      link.id,
      { icon: link.icon, color: link.color, visible: link.visible },
    ])
  );
  return {
    ...next,
    links: next.links.map((link) => ({
      ...link,
      ...(uiById.get(link.id) ?? {}),
    })),
  };
}

function normalizeDraftForCompare(draft: ProfileDraft) {
  return {
    id: draft.id,
    name: draft.name,
    handle: draft.handle,
    headline: draft.headline,
    headerImageUrl: draft.headerImageUrl,
    headerImageUpdatedAt: draft.headerImageUpdatedAt,
    theme: draft.theme,
    active: draft.active,
    links: draft.links.map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      icon: link.icon,
      color: link.color,
      visible: link.visible,
      clicks: link.clicks ?? 0,
    })),
  };
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

function insertAt<T>(items: T[], item: T, index: number) {
  const next = items.slice();
  next.splice(index, 0, item);
  return next;
}

function requestFocus(id: string) {
  if (!id) return;
  requestAnimationFrame(() => {
    const element = document.getElementById(id);
    if (element && "focus" in element) {
      (element as HTMLElement).focus();
    }
  });
}

function isTextInput(target: HTMLElement) {
  if (target.tagName === "TEXTAREA") return true;
  if (target.tagName !== "INPUT") return false;
  const input = target as HTMLInputElement;
  const type = input.type?.toLowerCase();
  return (
    type !== "checkbox" &&
    type !== "radio" &&
    type !== "button" &&
    type !== "submit"
  );
}
