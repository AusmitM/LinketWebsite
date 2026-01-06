"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  GripVertical,
  Instagram,
  Link2,
  LogOut,
  MessageSquare,
  Palette,
  Pencil,
  Trash2,
  User,
  X,
} from "lucide-react";

import AvatarUploader from "@/components/dashboard/AvatarUploader";
import LeadFormBuilder from "@/components/dashboard/LeadFormBuilder";
import VCardContent from "@/components/dashboard/vcard/VCardContent";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { buildAvatarPublicUrl } from "@/lib/avatar-utils";
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

type SectionId = "profile" | "contact" | "links" | "lead" | "style";

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
  { id: "contact", label: "Contact Card", icon: MessageSquare },
  { id: "links", label: "Links", icon: Link2 },
  { id: "lead", label: "Lead Form", icon: MessageSquare },
  { id: "style", label: "Style", icon: Palette },
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
  const [loggingOut, setLoggingOut] = useState(false);
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
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
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

  const autosavePending = useRef(false);
  const leadFormLoadRef = useRef(0);
  const draftRef = useRef<ProfileDraft | null>(null);
  const reorderSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragScrollFrame = useRef<number | null>(null);
  const leadFormReorderRef = useRef<
    ((sourceId: string, targetId: string) => void) | null
  >(null);
  const statusButtonRef = useRef<HTMLButtonElement | null>(null);
  const avatarButtonRef = useRef<HTMLButtonElement | null>(null);
  const viewButtonRef = useRef<HTMLButtonElement | null>(null);

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
        setAvatarUrl(
          buildAvatarPublicUrl(
            payload.avatarPath ?? null,
            payload.avatarUpdatedAt ?? null
          )
        );
      } catch {
        if (active) setAccountHandle(null);
      }
    })();
    return () => {
      active = false;
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
    draftRef.current = draft;
  }, [draft]);

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
    const draftSnapshot = draft;
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
    const handle = draft?.handle || accountHandle;
    if (!handle) {
      setProfileUrl(null);
      return;
    }
    setProfileUrl(buildPublicProfileUrl(handle));
  }, [accountHandle, draft?.handle]);

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
      setDraft((prev) => {
        if (!prev) return prev;
        const nextLinks = prev.links.some((link) => link.id === linkForm.id)
          ? prev.links.map((link) =>
              link.id === linkForm.id ? linkForm : link
            )
          : [...prev.links, linkForm];
        return { ...prev, links: nextLinks, updatedAt: new Date().toISOString() };
      });
    } else if (editingLinkId) {
      updateLink(editingLinkId, linkForm);
    }
    setLinkModalOpen(false);
  }, [editingLinkId, linkForm, linkModalMode, updateLink]);

  const handleCopyProfileLink = useCallback(async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast({ title: "Link copied", variant: "success" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to copy link";
      toast({ title: "Copy failed", description: message, variant: "destructive" });
    }
  }, [profileUrl]);

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

  const userInitials = useMemo(() => {
    const seed =
      dashboardUser?.user_metadata?.full_name ||
      dashboardUser?.email ||
      "PK";
    const [first, second] = String(seed).split(" ");
    const initialOne = first?.[0] ?? "P";
    const initialTwo = second?.[0] ?? "K";
    return `${initialOne}${initialTwo}`.toUpperCase();
  }, [dashboardUser]);

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

  const previewUrl = useMemo(() => {
    const handle = draft?.handle || accountHandle;
    if (!handle) return null;
    return buildPreviewUrl(handle);
  }, [accountHandle, draft?.handle]);
  const viewProfileUrl = Boolean(draft?.active) ? profileUrl : previewUrl;

  const handleViewProfile = useCallback(() => {
    if (!viewProfileUrl) return;
    window.open(viewProfileUrl, "_blank", "noreferrer");
  }, [viewProfileUrl]);

  const handlePublish = useCallback(() => {
    handleProfileChange({ active: true });
    void handleSave();
  }, [handleProfileChange, handleSave]);

  const handleUnpublish = useCallback(() => {
    handleProfileChange({ active: false });
    void handleSave();
  }, [handleProfileChange, handleSave]);

  const handlePreviewClick = useCallback(() => {
    if (!previewUrl) return;
    window.open(previewUrl, "_blank", "noreferrer");
  }, [previewUrl]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await fetch("/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "SIGNED_OUT" }),
      }).catch(() => null);
      toast({
        title: "Signed out",
        description: "You have been logged out safely.",
        variant: "success",
      });
      window.location.assign("/auth?view=signin");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Please try again.";
      toast({
        title: "Sign out failed",
        description: message,
        variant: "destructive",
      });
      setLoggingOut(false);
    }
  }, [loggingOut, supabase]);

  const profileDisplayName = draft?.name || "John Doe";
  const profileTagline =
    draft?.headline || "I do things | other things & more other things";

  return (
    <div className="space-y-6" onBlurCapture={handleBlurCapture}>
      <TopActionBar
        lastSavedAt={lastSavedAt}
        saveState={saveState}
        isDirty={isDirty}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onRetrySave={handleSave}
        isPublished={Boolean(draft?.active)}
        avatarInitials={userInitials}
        profileUrl={profileUrl}
        onViewProfile={handleViewProfile}
        onCopyProfile={handleCopyProfileLink}
        onLogout={handleLogout}
        logoutDisabled={loggingOut}
        statusPanelOpen={statusPanelOpen}
        setStatusPanelOpen={setStatusPanelOpen}
        avatarMenuOpen={avatarMenuOpen}
        setAvatarMenuOpen={setAvatarMenuOpen}
        viewMenuOpen={viewMenuOpen}
        setViewMenuOpen={setViewMenuOpen}
        statusButtonRef={statusButtonRef}
        avatarButtonRef={avatarButtonRef}
        viewButtonRef={viewButtonRef}
        onPreviewClick={handlePreviewClick}
      />

      <div className="grid gap-6 lg:grid-cols-[450px_minmax(0,1fr)_50px]">
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
            onLeadFormPreview={setLeadFormPreview}
            onRegisterLeadFormReorder={(reorder) => {
              leadFormReorderRef.current = reorder;
            }}
            onAvatarUpdate={setAvatarUrl}
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
            onVCardFields={(fields) =>
              setVcardSnapshot((prev) => ({
                ...prev,
                email: fields.email ?? "",
                phone: fields.phone ?? "",
                hasPhoto: Boolean(fields.photoData),
              }))
            }
            onVCardStatus={(payload) =>
              setVcardSnapshot((prev) => ({
                ...prev,
                status: payload.status,
                isDirty: payload.isDirty,
                error: payload.error,
              }))
            }
          />
        </div>
        <div className="flex justify-end self-start">
          <div className="origin-top-left scale-[1]">
            <PhonePreviewCard
              profile={{ name: profileDisplayName, tagline: profileTagline }}
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

function TopActionBar({
  lastSavedAt,
  saveState,
  isDirty,
  onPublish,
  onUnpublish,
  onRetrySave,
  isPublished,
  avatarInitials,
  profileUrl,
  onViewProfile,
  onCopyProfile,
  onLogout,
  logoutDisabled,
  statusPanelOpen,
  setStatusPanelOpen,
  avatarMenuOpen,
  setAvatarMenuOpen,
  viewMenuOpen,
  setViewMenuOpen,
  statusButtonRef,
  avatarButtonRef,
  viewButtonRef,
  onPreviewClick,
}: {
  lastSavedAt: string | null;
  saveState: "saving" | "saved" | "failed";
  isDirty: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onRetrySave: () => void;
  isPublished: boolean;
  avatarInitials: string;
  profileUrl: string | null;
  onViewProfile: () => void;
  onCopyProfile: () => void;
  onLogout: () => void;
  logoutDisabled: boolean;
  statusPanelOpen: boolean;
  setStatusPanelOpen: (open: boolean) => void;
  avatarMenuOpen: boolean;
  setAvatarMenuOpen: (open: boolean) => void;
  viewMenuOpen: boolean;
  setViewMenuOpen: (open: boolean) => void;
  statusButtonRef: React.RefObject<HTMLButtonElement | null>;
  avatarButtonRef: React.RefObject<HTMLButtonElement | null>;
  viewButtonRef: React.RefObject<HTMLButtonElement | null>;
  onPreviewClick: () => void;
}) {
  return (
    <div className="-mx-4 border-b border-border/60 bg-background/95 px-4 py-3 sm:-mx-6 lg:-mx-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          ref={statusButtonRef}
          onClick={() => setStatusPanelOpen(true)}
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Link2 className="h-4 w-4" aria-hidden />
          <span className="font-medium text-foreground">
            {isPublished ? "Published" : "Draft"}
          </span>
          <span>
            Last saved: {lastSavedAt ? formatShortDate(lastSavedAt) : "Just now"}
          </span>
          {isDirty && (
            <span className="text-amber-600">Unsaved changes</span>
          )}
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full border border-border/60"
              onClick={onViewProfile}
              disabled={!profileUrl}
              ref={viewButtonRef}
            >
              <Eye className="mr-2 h-4 w-4" aria-hidden />
              View Public Profile
            </Button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-accent"
              onClick={() => setViewMenuOpen(true)}
              aria-label="View profile menu"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            ref={avatarButtonRef}
            onClick={() => setAvatarMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-xs font-semibold text-muted-foreground"
          >
            {avatarInitials}
          </button>
        </div>
      </div>

      <PopoverDialog
        open={statusPanelOpen}
        onOpenChange={setStatusPanelOpen}
        anchorRef={statusButtonRef}
        title="Profile status"
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium text-foreground">
              {isPublished ? "Published" : "Draft"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last saved</span>
            <span className="font-medium text-foreground">
              {lastSavedAt ? formatShortDate(lastSavedAt) : "Just now"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Save state</span>
            <span
              className={cn(
                "font-medium",
                saveState === "failed" && "text-destructive",
                saveState === "saving" && "text-muted-foreground",
                saveState === "saved" &&
                  (isDirty ? "text-amber-600" : "text-foreground")
              )}
            >
              {saveState === "failed"
                ? "Save failed"
                : saveState === "saving"
                ? "Saving..."
                : isDirty
                ? "Unsaved changes"
                : "Saved"}
            </span>
          </div>
          {saveState === "failed" ? (
            <Button variant="outline" size="sm" onClick={onRetrySave}>
              Retry save
            </Button>
          ) : null}
          <Button size="sm" onClick={isPublished ? onUnpublish : onPublish}>
            {isPublished ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </PopoverDialog>

      <PopoverDialog
        open={viewMenuOpen}
        onOpenChange={setViewMenuOpen}
        anchorRef={viewButtonRef}
        title="View options"
      >
        <div className="space-y-2 text-sm">
          <MenuButton onClick={onPreviewClick} disabled={!profileUrl}>
            Preview
          </MenuButton>
          <MenuButton onClick={onCopyProfile} disabled={!profileUrl}>
            Copy link
          </MenuButton>
          {!isPublished && (
            <MenuButton onClick={onPublish}>Publish</MenuButton>
          )}
        </div>
      </PopoverDialog>

      <PopoverDialog
        open={avatarMenuOpen}
        onOpenChange={setAvatarMenuOpen}
        anchorRef={avatarButtonRef}
        title="Account menu"
      >
        <div className="space-y-2 text-sm">
          <MenuLink href="/dashboard/settings">Account settings</MenuLink>
          <MenuLink href="/dashboard/billing">Billing</MenuLink>
          <MenuButton
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-support"))
            }
          >
            Support
          </MenuButton>
          <MenuButton onClick={onLogout} disabled={logoutDisabled}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </MenuButton>
        </div>
      </PopoverDialog>
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
        <div className="mt-3 space-y-1">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
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
                <Icon className="h-4 w-4" aria-hidden />
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
  onAvatarUpdate,
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
  onAvatarUpdate: (url: string) => void;
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
              placeholder="Engineer, founder, creative..."
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
        onFieldsChange={(fields) =>
          onVCardFields({
            email: fields.email,
            phone: fields.phone,
            photoData: fields.photoData,
          })
        }
        onStatusChange={(payload) =>
          onVCardStatus({
            status: payload.status,
            isDirty: payload.isDirty,
            error: payload.error,
          })
        }
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
                    placeholder="https://"
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
      <div className="h-28 rounded-t-[36px] bg-gradient-to-r from-[#7C4DA0] via-[#B26A85] to-[#E1A37B]" />
      <div className="flex flex-col items-center px-6 pb-6">
        <div className="-mt-10 h-20 w-20 overflow-hidden rounded-full border-4 border-background bg-muted shadow-sm" />
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

function PopoverDialog({
  open,
  onOpenChange,
  anchorRef,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  title: string;
  children: ReactNode;
}) {
  const position = usePopoverPosition(anchorRef, open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-72 translate-x-0 translate-y-0 rounded-2xl border border-border/60 bg-background p-4 shadow-lg"
        style={position}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function MenuButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-accent disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function MenuLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="flex w-full items-center rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-accent"
    >
      {children}
    </a>
  );
}

function usePopoverPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean
) {
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const top = rect.bottom + 8;
      const left = Math.min(
        Math.max(12, rect.left),
        window.innerWidth - 300
      );
      setStyle({
        position: "fixed",
        top,
        left,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, open]);

  return style;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildPublicProfileUrl(handle: string) {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL;
  const base =
    envBase && envBase.length > 0
      ? envBase
      : typeof window !== "undefined"
      ? window.location.origin
      : "https://linketconnect.com";
  return `${base.replace(/\/$/, "")}/${encodeURIComponent(handle)}`;
}

function buildPreviewUrl(handle: string) {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL;
  const base =
    envBase && envBase.length > 0
      ? envBase
      : typeof window !== "undefined"
      ? window.location.origin
      : "https://linketconnect.com";
  return `${base.replace(/\/$/, "")}/u/${encodeURIComponent(handle)}/preview`;
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
    url: "https://",
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
