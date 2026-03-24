"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Globe,
  Link2,
  Loader2,
  Palette,
  Plus,
  Trash2,
} from "lucide-react";

import AvatarUploader from "@/components/dashboard/AvatarUploader";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import { toast } from "@/components/system/toaster";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { trackEvent } from "@/lib/analytics";
import { getSignedAvatarUrl } from "@/lib/avatar-client";
import type { DashboardOnboardingState } from "@/lib/dashboard-onboarding-types";
import type { ProfileWithLinks } from "@/lib/profile-service";
import {
  getConfiguredSiteHost,
  getSiteOrigin,
  toPublicProfileUrl,
} from "@/lib/site-url";
import { normalizeThemeName, type ThemeName } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SetupStepId = "profile" | "contact" | "links" | "publish";
type SaveStatus = "idle" | "saving" | "saved" | "error" | "publishing";

type ProfileLinkDraft = {
  id?: string;
  title: string;
  url: string;
  isActive: boolean;
  isOverride: boolean;
};

type ProfileDraft = {
  id: string;
  name: string;
  handle: string;
  headline: string;
  headerImageUrl: string | null;
  headerImageUpdatedAt: string | null;
  headerImageOriginalFileName: string | null;
  logoUrl: string | null;
  logoUpdatedAt: string | null;
  logoOriginalFileName: string | null;
  logoShape: "circle" | "rect";
  logoBackgroundWhite: boolean;
  links: ProfileLinkDraft[];
  theme: ThemeName;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type ContactDraft = {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  company: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressRegion: string;
  addressPostal: string;
  addressCountry: string;
  note: string;
  photoData: string | null;
  photoName: string | null;
};

type AccountDraft = {
  handle: string;
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
  avatarOriginalFileName: string | null;
  displayName: string | null;
};

const AUTO_HANDLE_PATTERN = /^user-[0-9a-f]{8}$/i;
const DEFAULT_LINK_HOST = getConfiguredSiteHost();
const MAX_LINK_ROWS = 5;

const SETUP_STEPS: Array<{
  id: SetupStepId;
  label: string;
  description: string;
}> = [
  { id: "profile", label: "Profile", description: "Photo, name, public URL, and intro" },
  { id: "contact", label: "Contact card", description: "How people save you" },
  { id: "links", label: "Links + theme", description: "Add your first buttons, then choose a look" },
  { id: "publish", label: "Review + publish", description: "Go live and test once" },
];

const FEATURED_THEMES: Array<{
  value: ThemeName;
  label: string;
  description: string;
  swatchClassName: string;
}> = [
  {
    value: "autumn",
    label: "Autumn",
    description: "Warm, premium, approachable",
    swatchClassName:
      "bg-[linear-gradient(135deg,#fff1e6_0%,#ffb37a_48%,#ff7b6b_100%)]",
  },
  {
    value: "dream",
    label: "Dream",
    description: "Soft, modern, polished",
    swatchClassName:
      "bg-[linear-gradient(135deg,#f8f4ff_0%,#cdb7ff_45%,#7dd3fc_100%)]",
  },
  {
    value: "honey",
    label: "Honey",
    description: "Bright, upbeat, friendly",
    swatchClassName:
      "bg-[linear-gradient(135deg,#fff7cc_0%,#ffd166_42%,#ff9f1c_100%)]",
  },
  {
    value: "forest",
    label: "Forest",
    description: "Confident, grounded, rich",
    swatchClassName:
      "bg-[linear-gradient(135deg,#0f3d2f_0%,#1f7a53_52%,#9ad7b9_100%)]",
  },
  {
    value: "midnight",
    label: "Midnight",
    description: "Bold, sleek, high contrast",
    swatchClassName:
      "bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_45%,#4f46e5_100%)]",
  },
  {
    value: "rose",
    label: "Rose",
    description: "Editorial, expressive, clean",
    swatchClassName:
      "bg-[linear-gradient(135deg,#fff1f2_0%,#fda4af_42%,#fb7185_100%)]",
  },
];

function buildEmptyLink(partial?: Partial<ProfileLinkDraft>): ProfileLinkDraft {
  return {
    title: "",
    url: "",
    isActive: true,
    isOverride: false,
    ...partial,
  };
}

function isAutoHandle(handle: string) {
  return AUTO_HANDLE_PATTERN.test(handle.trim());
}

function sanitizeHandleInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildSuggestedHandle(name: string, userId: string) {
  const slug = sanitizeHandleInput(name);
  return slug || `user-${userId.slice(0, 8)}`;
}

function normalizeLinkUrlInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, "https://");
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function normaliseLinkUrl(url: string | null | undefined) {
  const raw = normalizeLinkUrlInput(url ?? "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${host}${path || "/"}`;
  } catch {
    return raw
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "");
  }
}

function isStarterLink(url: string | null | undefined) {
  const normalized = normaliseLinkUrl(url);
  return normalized === DEFAULT_LINK_HOST || normalized === `${DEFAULT_LINK_HOST}/`;
}

function isMeaningfulLink(url: string | null | undefined) {
  const normalized = normaliseLinkUrl(url);
  return Boolean(normalized) && !isStarterLink(url);
}

function deriveLinkTitle(title: string, url: string) {
  const trimmedTitle = title.trim();
  if (trimmedTitle) return trimmedTitle;
  const normalized = normalizeLinkUrlInput(url);
  if (!normalized) return "Website";
  try {
    const host = new URL(normalized).hostname.replace(/^www\./, "");
    const firstLabel = host.split(".")[0] || "Website";
    return firstLabel
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return "Website";
  }
}

function formatSavedTime(value: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function getDeviceType() {
  if (typeof window === "undefined") return "desktop";
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

function buildPublicUrl(handle: string) {
  const normalizedHandle = sanitizeHandleInput(handle);
  if (!normalizedHandle) return "";
  return toPublicProfileUrl(normalizedHandle, getSiteOrigin());
}

function buildPreviewProfile(
  draft: ProfileDraft,
  userId: string
): ProfileWithLinks {
  const now = new Date().toISOString();
  const links = draft.links.reduce<ProfileWithLinks["links"]>((items, link, index) => {
    const normalizedUrl = normalizeLinkUrlInput(link.url);
    if (!normalizedUrl) {
      return items;
    }

    items.push({
      id: link.id || `preview-link-${index}`,
      profile_id: draft.id || "preview-profile",
      user_id: userId,
      title: deriveLinkTitle(link.title, normalizedUrl),
      url: normalizedUrl,
      order_index: index,
      is_active: link.isActive,
      is_override: link.isOverride,
      click_count: 0,
      created_at: now,
      updated_at: now,
    });

    return items;
  }, []);

  return {
    id: draft.id || "preview-profile",
    user_id: userId,
    name: draft.name.trim() || "Your Name",
    handle: sanitizeHandleInput(draft.handle) || `user-${userId.slice(0, 8)}`,
    headline: draft.headline.trim() || null,
    header_image_url: draft.headerImageUrl,
    header_image_updated_at: draft.headerImageUpdatedAt,
    header_image_original_file_name: draft.headerImageOriginalFileName,
    logo_url: draft.logoUrl,
    logo_updated_at: draft.logoUpdatedAt,
    logo_original_file_name: draft.logoOriginalFileName,
    logo_shape: draft.logoShape,
    logo_bg_white: draft.logoBackgroundWhite,
    theme: normalizeThemeName(draft.theme, "autumn"),
    is_active: true,
    created_at: draft.createdAt || now,
    updated_at: draft.updatedAt || now,
    links,
  };
}

function mapProfileRecord(record: ProfileWithLinks): ProfileDraft {
  return {
    id: record.id,
    name: record.name ?? "",
    handle: record.handle ?? "",
    headline: record.headline ?? "",
    headerImageUrl: record.header_image_url ?? null,
    headerImageUpdatedAt: record.header_image_updated_at ?? null,
    headerImageOriginalFileName: record.header_image_original_file_name ?? null,
    logoUrl: record.logo_url ?? null,
    logoUpdatedAt: record.logo_updated_at ?? null,
    logoOriginalFileName: record.logo_original_file_name ?? null,
    logoShape: record.logo_shape === "rect" ? "rect" : "circle",
    logoBackgroundWhite: Boolean(record.logo_bg_white),
    links:
      record.links?.map((link) => ({
        id: link.id,
        title: link.title ?? "",
        url: link.url ?? "",
        isActive: link.is_active ?? true,
        isOverride: link.is_override ?? false,
      })) ?? [],
    theme: normalizeThemeName(record.theme, "autumn"),
    active: record.is_active,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function mapContactFields(
  fields: Partial<ContactDraft> | null | undefined,
  fallbackName: string
): ContactDraft {
  return {
    fullName: fields?.fullName?.trim() || fallbackName,
    title: fields?.title ?? "",
    email: fields?.email ?? "",
    phone: fields?.phone ?? "",
    company: fields?.company ?? "",
    addressLine1: fields?.addressLine1 ?? "",
    addressLine2: fields?.addressLine2 ?? "",
    addressCity: fields?.addressCity ?? "",
    addressRegion: fields?.addressRegion ?? "",
    addressPostal: fields?.addressPostal ?? "",
    addressCountry: fields?.addressCountry ?? "",
    note: fields?.note ?? "",
    photoData: fields?.photoData ?? null,
    photoName: fields?.photoName ?? null,
  };
}

function prepareSetupLinks(draft: ProfileDraft, publishEventCount: number) {
  const currentLinks = draft.links.length ? draft.links : [buildEmptyLink()];
  if (
    publishEventCount === 0 &&
    currentLinks.length === 1 &&
    isStarterLink(currentLinks[0].url)
  ) {
    return {
      ...draft,
      links: [buildEmptyLink({ id: currentLinks[0].id })],
    };
  }
  return {
    ...draft,
    links: currentLinks,
  };
}

function buildProfileSavePayload(draft: ProfileDraft, active: boolean) {
  return {
    id: draft.id,
    name: draft.name.trim(),
    handle: sanitizeHandleInput(draft.handle),
    headline: draft.headline.trim(),
    headerImageUrl: draft.headerImageUrl,
    headerImageUpdatedAt: draft.headerImageUpdatedAt,
    headerImageOriginalFileName: draft.headerImageOriginalFileName,
    logoUrl: draft.logoUrl,
    logoUpdatedAt: draft.logoUpdatedAt,
    logoOriginalFileName: draft.logoOriginalFileName,
    logoShape: draft.logoShape,
    logoBackgroundWhite: draft.logoBackgroundWhite,
    theme: normalizeThemeName(draft.theme, "autumn"),
    links: draft.links
      .map((link) => {
        const normalizedUrl = normalizeLinkUrlInput(link.url);
        if (!normalizedUrl) return null;
        return {
          id: link.id,
          title: deriveLinkTitle(link.title, normalizedUrl),
          url: normalizedUrl,
          isActive: link.isActive,
          isOverride: link.isOverride,
        };
      })
      .filter((link): link is NonNullable<typeof link> => Boolean(link)),
    active,
  };
}

function buildProfileDraftSignature(draft: ProfileDraft | null) {
  if (!draft) return "";
  return JSON.stringify(buildProfileSavePayload(draft, false));
}

function buildContactPayload(contact: ContactDraft, fallbackName: string) {
  return {
    fields: {
      ...contact,
      fullName: contact.fullName.trim() || fallbackName.trim(),
      title: contact.title.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
      company: contact.company.trim(),
      addressLine1: contact.addressLine1.trim(),
      addressLine2: contact.addressLine2.trim(),
      addressCity: contact.addressCity.trim(),
      addressRegion: contact.addressRegion.trim(),
      addressPostal: contact.addressPostal.trim(),
      addressCountry: contact.addressCountry.trim(),
      note: contact.note.trim(),
      photoData: contact.photoData,
      photoName: contact.photoName,
    },
  };
}

function buildContactDraftSignature(
  contact: ContactDraft | null,
  fallbackName: string
) {
  if (!contact) return "";
  return JSON.stringify(buildContactPayload(contact, fallbackName));
}

function getInitialStepIndex(input: {
  profileComplete: boolean;
  contactComplete: boolean;
  linksComplete: boolean;
}) {
  if (!input.profileComplete) return 0;
  if (!input.contactComplete) return 1;
  if (!input.linksComplete) return 2;
  return 3;
}

function buildPreviewInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "LP";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getThemeSwatchClassName(theme: ThemeName) {
  return (
    FEATURED_THEMES.find((option) => option.value === theme)?.swatchClassName ??
    FEATURED_THEMES[0].swatchClassName
  );
}

function SetupLivePreviewCard({
  avatarUrl,
  contactEnabled,
  displayName,
  headline,
  links,
  publicUrl,
  theme,
}: {
  avatarUrl: string | null;
  contactEnabled: boolean;
  displayName: string;
  headline: string;
  links: ProfileWithLinks["links"];
  publicUrl: string;
  theme: ThemeName;
}) {
  const previewLinks = links.slice(0, 2);
  const initials = buildPreviewInitials(displayName);

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.28)]">
      <div className={cn("h-24 w-full", getThemeSwatchClassName(theme))} />
      <div className="-mt-10 px-5 pb-5">
        <div className="inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-[26px] border-4 border-white bg-slate-100 text-lg font-semibold text-slate-700 shadow-sm">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={`${displayName} profile photo`}
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        <div className="mt-4 space-y-2">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-slate-900">{displayName}</p>
            <p className="break-all text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              {publicUrl.replace(/^https?:\/\//, "")}
            </p>
          </div>
          <p className="min-h-[44px] text-sm leading-6 text-slate-600">
            {headline.trim() || "Your one-line intro shows up here."}
          </p>
        </div>

        <div className="mt-5 space-y-2.5">
          <div
            className={cn(
              "flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition",
              contactEnabled
                ? "bg-slate-900 text-white"
                : "border border-dashed border-slate-200 bg-slate-50 text-slate-400"
            )}
          >
            {contactEnabled ? "Save Contact" : "Add contact details"}
          </div>

          {previewLinks.length ? (
            previewLinks.map((link) => (
              <div
                key={link.id}
                className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700"
              >
                <span className="truncate font-medium text-slate-900">
                  {link.title}
                </span>
                <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
            ))
          ) : (
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-sm text-slate-400">
              <span>Add your first link</span>
              <Globe className="h-4 w-4 shrink-0" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardSetupFlow({
  initialOnboardingState,
}: {
  initialOnboardingState: DashboardOnboardingState;
}) {
  const user = useDashboardUser();
  const { setTheme } = useThemeOptional();
  const [loading, setLoading] = useState(true);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const [contactDraft, setContactDraft] = useState<ContactDraft | null>(null);
  const [account, setAccount] = useState<AccountDraft>({
    handle: initialOnboardingState.activeProfile.handle,
    avatarPath: initialOnboardingState.account.avatarPath,
    avatarUpdatedAt: initialOnboardingState.account.avatarUpdatedAt,
    avatarOriginalFileName: null,
    displayName: initialOnboardingState.account.displayName,
  });
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(
    getInitialStepIndex({
      profileComplete: initialOnboardingState.steps.profile,
      contactComplete: initialOnboardingState.steps.contact,
      linksComplete: initialOnboardingState.steps.links,
    })
  );
  const [profileSaveStatus, setProfileSaveStatus] = useState<SaveStatus>("idle");
  const [contactSaveStatus, setContactSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showLaunchHub, setShowLaunchHub] = useState(false);
  const [publishedThisSession, setPublishedThisSession] = useState(false);
  const [shareTestComplete, setShareTestComplete] = useState(
    initialOnboardingState.hasTestedShare
  );
  const [handleTouched, setHandleTouched] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);

  const setupStartedAtRef = useRef(Date.now());
  const profileDraftRef = useRef<ProfileDraft | null>(null);
  const contactDraftRef = useRef<ContactDraft | null>(null);
  const savedProfileSignatureRef = useRef("");
  const savedContactSignatureRef = useRef("");
  const profileSavePromiseRef = useRef<Promise<ProfileDraft | null> | null>(null);
  const contactSavePromiseRef = useRef<Promise<ContactDraft | null> | null>(null);
  const queuedProfileSaveRef = useRef(false);
  const queuedContactSaveRef = useRef(false);
  const startedTrackingRef = useRef(false);
  const lastStepViewRef = useRef<SetupStepId | null>(null);
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  const profileDraftSignature = useMemo(
    () => buildProfileDraftSignature(profileDraft),
    [profileDraft]
  );
  const contactDraftSignature = useMemo(
    () => buildContactDraftSignature(contactDraft, profileDraft?.name ?? ""),
    [contactDraft, profileDraft?.name]
  );
  const suggestedHandle = useMemo(() => {
    if (!userId) return "";
    return buildSuggestedHandle(profileDraft?.name ?? "", userId);
  }, [profileDraft?.name, userId]);

  useEffect(() => {
    profileDraftRef.current = profileDraft;
  }, [profileDraft]);

  useEffect(() => {
    contactDraftRef.current = contactDraft;
  }, [contactDraft]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!account.avatarPath) {
        if (active) setAvatarPreviewUrl(null);
        return;
      }
      const signed = await getSignedAvatarUrl(
        account.avatarPath,
        account.avatarUpdatedAt
      );
      if (active) setAvatarPreviewUrl(signed);
    })();
    return () => {
      active = false;
    };
  }, [account.avatarPath, account.avatarUpdatedAt]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [profilesRes, accountRes, contactRes] = await Promise.all([
          fetch(`/api/linket-profiles?userId=${encodeURIComponent(userId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/account/handle?userId=${encodeURIComponent(userId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/vcard/profile?userId=${encodeURIComponent(userId)}`, {
            cache: "no-store",
          }),
        ]);

        if (!profilesRes.ok) {
          const info = await profilesRes.json().catch(() => ({}));
          throw new Error(info?.error || "Unable to load your public profile.");
        }

        const profiles = (await profilesRes.json()) as ProfileWithLinks[];
        const activeProfile =
          profiles.find((profile) => profile.is_active) ?? profiles[0];
        if (!activeProfile) {
          throw new Error("We couldn't create your starter profile.");
        }

        const accountPayload = accountRes.ok
          ? ((await accountRes.json().catch(() => ({}))) as {
              handle?: string | null;
              avatarPath?: string | null;
              avatarUpdatedAt?: string | null;
              avatarOriginalFileName?: string | null;
              displayName?: string | null;
            })
          : {};
        const contactPayload = contactRes.ok
          ? ((await contactRes.json().catch(() => ({}))) as {
              fields?: Partial<ContactDraft>;
            })
          : {};

        const mappedProfile = prepareSetupLinks(
          mapProfileRecord(activeProfile),
          initialOnboardingState.publishEventCount
        );
        const mappedContact = mapContactFields(
          contactPayload.fields,
          mappedProfile.name
        );

        if (cancelled) return;

        setProfileDraft(mappedProfile);
        setContactDraft(mappedContact);
        setAccount({
          handle:
            accountPayload.handle?.trim() ||
            mappedProfile.handle ||
            initialOnboardingState.activeProfile.handle,
          avatarPath:
            accountPayload.avatarPath ??
            initialOnboardingState.account.avatarPath ??
            null,
          avatarUpdatedAt:
            accountPayload.avatarUpdatedAt ??
            initialOnboardingState.account.avatarUpdatedAt ??
            null,
          avatarOriginalFileName: accountPayload.avatarOriginalFileName ?? null,
          displayName:
            accountPayload.displayName ??
            initialOnboardingState.account.displayName ??
            null,
        });
        setHandleTouched(!isAutoHandle(mappedProfile.handle));
        savedProfileSignatureRef.current = buildProfileDraftSignature(mappedProfile);
        savedContactSignatureRef.current = buildContactDraftSignature(
          mappedContact,
          mappedProfile.name
        );
        setTheme(mappedProfile.theme);
        setCurrentStepIndex(
          getInitialStepIndex({
            profileComplete:
              Boolean(mappedProfile.name.trim()) &&
              Boolean(
                accountPayload.avatarPath ??
                  initialOnboardingState.account.avatarPath
              ) &&
              !isAutoHandle(mappedProfile.handle),
            contactComplete: Boolean(
              mappedContact.email.trim() || mappedContact.phone.trim()
            ),
            linksComplete: mappedProfile.links.some((link) =>
              isMeaningfulLink(link.url)
            ),
          })
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load your setup flow.";
        setSaveError(message);
        toast({
          title: "Setup unavailable",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    initialOnboardingState.account.avatarPath,
    initialOnboardingState.account.avatarUpdatedAt,
    initialOnboardingState.account.displayName,
    initialOnboardingState.activeProfile.handle,
    initialOnboardingState.publishEventCount,
    setTheme,
    userId,
  ]);

  const liveProfileReady =
    Boolean(profileDraft?.name.trim()) &&
    Boolean(account.avatarPath) &&
    Boolean(profileDraft?.handle.trim()) &&
    !isAutoHandle(profileDraft?.handle ?? "");
  const contactReady = Boolean(
    contactDraft?.email.trim() || contactDraft?.phone.trim()
  );
  const linksReady = Boolean(
    profileDraft?.links.some((link) => isMeaningfulLink(link.url))
  );
  const publishReady = initialOnboardingState.hasPublished || publishedThisSession;

  const previewProfile = useMemo(() => {
    if (!profileDraft || !userId) return null;
    return buildPreviewProfile(profileDraft, userId);
  }, [profileDraft, userId]);

  const publicUrl = useMemo(
    () => buildPublicUrl(profileDraft?.handle ?? account.handle),
    [account.handle, profileDraft?.handle]
  );

  const autosaveLabel = useMemo(() => {
    if (profileSaveStatus === "publishing") return "Publishing page";
    if (profileSaveStatus === "saving" || contactSaveStatus === "saving") {
      return "Saving...";
    }
    if (
      profileSaveStatus === "error" ||
      contactSaveStatus === "error" ||
      saveError
    ) {
      return "Save issue";
    }
    const savedAt = formatSavedTime(lastSavedAt);
    if (savedAt) return `Saved ${savedAt}`;
    return "Autosave on";
  }, [contactSaveStatus, lastSavedAt, profileSaveStatus, saveError]);

  const profileHasUnsavedChanges =
    profileDraftSignature !== savedProfileSignatureRef.current;
  const handleStatus = useMemo(() => {
    const slug = profileDraft?.handle.trim() ?? "";
    if (!slug) {
      return {
        label: "Add a custom slug",
        className: "text-slate-500",
      };
    }
    if (handleError) {
      return {
        label: "Unavailable",
        className: "text-red-600",
      };
    }
    if (isAutoHandle(slug)) {
      return {
        label: "Choose a custom slug",
        className: "text-amber-700",
      };
    }
    if (profileSaveStatus === "saving" || profileHasUnsavedChanges) {
      return {
        label: "Checking...",
        className: "text-slate-500",
      };
    }
    return {
      label: "Available",
      className: "text-emerald-700",
    };
  }, [handleError, profileDraft?.handle, profileHasUnsavedChanges, profileSaveStatus]);

  const trackingMeta = (extra?: Record<string, unknown>) => ({
    source: "dashboard_get_started",
    device_type: getDeviceType(),
    elapsed_ms: Date.now() - setupStartedAtRef.current,
    handle: sanitizeHandleInput(profileDraftRef.current?.handle ?? ""),
    link_count:
      profileDraftRef.current?.links.filter((link) => isMeaningfulLink(link.url))
        .length ?? 0,
    ...extra,
  });

  useEffect(() => {
    if (loading || startedTrackingRef.current) return;
    startedTrackingRef.current = true;
    void trackEvent(
      "onboarding_started",
      trackingMeta({
        initial_step: SETUP_STEPS[currentStepIndex]?.id ?? "profile",
        claimed_linkets: initialOnboardingState.claimedLinketCount,
      })
    );
  }, [currentStepIndex, initialOnboardingState.claimedLinketCount, loading]);

  useEffect(() => {
    if (loading) return;
    const stepId = SETUP_STEPS[currentStepIndex]?.id;
    if (!stepId || lastStepViewRef.current === stepId) return;
    lastStepViewRef.current = stepId;
    void trackEvent(
      "onboarding_step_viewed",
      trackingMeta({
        step_id: stepId,
        step_index: currentStepIndex + 1,
      })
    );
  }, [currentStepIndex, loading]);

  const saveProfileDraft = useCallback(
    async function saveProfileDraftImpl(options?: {
      publish?: boolean;
      quiet?: boolean;
    }) {
      const draft = profileDraftRef.current;
      if (!draft || !userId) return null;

      const publish = Boolean(options?.publish);
      const quiet = Boolean(options?.quiet);
      const nextSignature = buildProfileDraftSignature(draft);

      if (!publish && nextSignature === savedProfileSignatureRef.current) {
        setProfileSaveStatus("saved");
        return draft;
      }

      if (profileSavePromiseRef.current) {
        await profileSavePromiseRef.current;
        if (!publish) {
          const refreshedDraft = profileDraftRef.current;
          if (
            refreshedDraft &&
            buildProfileDraftSignature(refreshedDraft) ===
              savedProfileSignatureRef.current
          ) {
            return refreshedDraft;
          }
        }
      }

      const request = (async () => {
        setProfileSaveStatus(publish ? "publishing" : "saving");
        setSaveError(null);
        setHandleError(null);
        try {
          const response = await fetch("/api/linket-profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              profile: buildProfileSavePayload(draft, publish),
            }),
          });

          if (!response.ok) {
            const info = await response.json().catch(() => ({}));
            const suggestions = Array.isArray(info?.suggestions)
              ? info.suggestions
              : [];
            const hint = suggestions.length
              ? ` Try ${suggestions.join(", ")}.`
              : "";
            const message = `${info?.error || "Unable to save your page."}${hint}`;
            if (response.status === 409) {
              setHandleError(message);
            }
            throw new Error(message);
          }

          const savedRecord = mapProfileRecord(
            (await response.json()) as ProfileWithLinks
          );
          savedProfileSignatureRef.current =
            buildProfileDraftSignature(savedRecord);
          setLastSavedAt(new Date().toISOString());
          setProfileSaveStatus("saved");
          setTheme(savedRecord.theme);

          if (
            buildProfileDraftSignature(profileDraftRef.current) ===
              nextSignature ||
            publish
          ) {
            setProfileDraft(savedRecord);
          }

          return savedRecord;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unable to save your page.";
          setProfileSaveStatus("error");
          setSaveError(message);
          if (!quiet) {
            toast({
              title: publish ? "Publish failed" : "Save failed",
              description: message,
              variant: "destructive",
            });
          }
          return null;
        }
      })();

      profileSavePromiseRef.current = request;
      try {
        return await request;
      } finally {
        profileSavePromiseRef.current = null;
        if (!publish && queuedProfileSaveRef.current) {
          queuedProfileSaveRef.current = false;
          void saveProfileDraftImpl({ quiet: true });
        }
      }
    },
    [setTheme, userId]
  );

  const saveContactDraft = useCallback(
    async function saveContactDraftImpl(options?: { quiet?: boolean }) {
      const draft = contactDraftRef.current;
      const fallbackName = profileDraftRef.current?.name ?? "";
      if (!draft || !userId) return null;

      const nextSignature = buildContactDraftSignature(draft, fallbackName);
      if (nextSignature === savedContactSignatureRef.current) {
        setContactSaveStatus("saved");
        return draft;
      }

      if (contactSavePromiseRef.current) {
        await contactSavePromiseRef.current;
        const refreshed = contactDraftRef.current;
        if (
          refreshed &&
          buildContactDraftSignature(
            refreshed,
            profileDraftRef.current?.name ?? ""
          ) === savedContactSignatureRef.current
        ) {
          return refreshed;
        }
      }

      const request = (async () => {
        setContactSaveStatus("saving");
        setSaveError(null);
        try {
          const response = await fetch("/api/vcard/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              ...buildContactPayload(draft, fallbackName),
            }),
          });

          if (!response.ok) {
            const info = await response.json().catch(() => ({}));
            throw new Error(info?.error || "Unable to save your contact card.");
          }

          const payload = (await response.json()) as {
            fields?: Partial<ContactDraft>;
          };
          const savedDraft = mapContactFields(payload.fields, fallbackName);
          savedContactSignatureRef.current = buildContactDraftSignature(
            savedDraft,
            fallbackName
          );
          setLastSavedAt(new Date().toISOString());
          setContactSaveStatus("saved");

          if (
            buildContactDraftSignature(
              contactDraftRef.current,
              profileDraftRef.current?.name ?? ""
            ) === nextSignature
          ) {
            setContactDraft(savedDraft);
          }

          return savedDraft;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to save your contact card.";
          setContactSaveStatus("error");
          setSaveError(message);
          if (!options?.quiet) {
            toast({
              title: "Contact card not saved",
              description: message,
              variant: "destructive",
            });
          }
          return null;
        }
      })();

      contactSavePromiseRef.current = request;
      try {
        return await request;
      } finally {
        contactSavePromiseRef.current = null;
        if (queuedContactSaveRef.current) {
          queuedContactSaveRef.current = false;
          void saveContactDraftImpl({ quiet: true });
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    if (loading || !profileDraft || !userId || showLaunchHub) return;
    if (profileDraftSignature === savedProfileSignatureRef.current) return;

    const timer = window.setTimeout(() => {
      if (profileSavePromiseRef.current) {
        queuedProfileSaveRef.current = true;
        return;
      }
      void saveProfileDraft({ quiet: true });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    loading,
    profileDraft,
    profileDraftSignature,
    saveProfileDraft,
    showLaunchHub,
    userId,
  ]);

  useEffect(() => {
    if (
      loading ||
      !contactDraft ||
      !profileDraft ||
      !userId ||
      showLaunchHub
    ) {
      return;
    }
    if (contactDraftSignature === savedContactSignatureRef.current) return;

    const timer = window.setTimeout(() => {
      if (contactSavePromiseRef.current) {
        queuedContactSaveRef.current = true;
        return;
      }
      void saveContactDraft({ quiet: true });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    contactDraft,
    contactDraftSignature,
    loading,
    profileDraft,
    saveContactDraft,
    showLaunchHub,
    userId,
  ]);

  function updateProfileDraft(updater: (current: ProfileDraft) => ProfileDraft) {
    setProfileDraft((current) => {
      if (!current) return current;
      return updater(current);
    });
    setStepError(null);
    setSaveError(null);
  }

  function updateContactDraft(updater: (current: ContactDraft) => ContactDraft) {
    setContactDraft((current) => {
      if (!current) return current;
      return updater(current);
    });
    setStepError(null);
    setSaveError(null);
  }

  function validateStep(stepIndex: number) {
    switch (SETUP_STEPS[stepIndex]?.id) {
      case "profile":
        if (!profileDraft?.name.trim()) {
          return "Add your name so visitors know whose page this is.";
        }
        if (!account.avatarPath) {
          return "Upload a photo so your page feels complete and trustworthy.";
        }
        if (!profileDraft.handle.trim() || isAutoHandle(profileDraft.handle)) {
          return "Choose a simple public link instead of the default user code.";
        }
        return null;
      case "contact":
        if (!contactDraft?.email.trim() && !contactDraft?.phone.trim()) {
          return "Add an email or phone number so Save Contact works.";
        }
        return null;
      case "links":
        if (!profileDraft?.links.some((link) => isMeaningfulLink(link.url))) {
          return "Add at least one real link people can tap first.";
        }
        return null;
      default:
        if (!liveProfileReady) return "Finish your photo, name, and public link first.";
        if (!contactReady) return "Add an email or phone number before publishing.";
        if (!linksReady) return "Add your first real link before publishing.";
        return null;
    }
  }

  async function handleContinue() {
    const error = validateStep(currentStepIndex);
    if (error) {
      setStepError(error);
      return;
    }

    const stepId = SETUP_STEPS[currentStepIndex]?.id;
    if (stepId === "profile" || stepId === "links") {
      const saved = await saveProfileDraft({ quiet: true });
      if (!saved) return;
    }
    if (stepId === "contact") {
      const saved = await saveContactDraft({ quiet: true });
      if (!saved) return;
    }

    setStepError(null);
    void trackEvent(
      "onboarding_step_completed",
      trackingMeta({
        step_id: stepId,
        step_index: currentStepIndex + 1,
      })
    );
    if (stepId === "links") {
      void trackEvent("primary_link_added", trackingMeta({ step_id: stepId }));
    }

    setCurrentStepIndex((current) =>
      Math.min(current + 1, SETUP_STEPS.length - 1)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePublish() {
    const error = validateStep(SETUP_STEPS.length - 1);
    if (error) {
      setStepError(error);
      if (!liveProfileReady) setCurrentStepIndex(0);
      else if (!contactReady) setCurrentStepIndex(1);
      else if (!linksReady) setCurrentStepIndex(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setStepError(null);
    void trackEvent("onboarding_publish_clicked", trackingMeta());

    const [savedContact, savedProfile] = await Promise.all([
      saveContactDraft({ quiet: true }),
      saveProfileDraft({ quiet: true }),
    ]);
    if (!savedContact || !savedProfile) return;

    const published = await saveProfileDraft({ publish: true, quiet: false });
    if (!published) return;

    setPublishedThisSession(true);
    setShowLaunchHub(true);
    setProfileSaveStatus("saved");
    setContactSaveStatus("saved");
    void trackEvent("onboarding_publish_succeeded", trackingMeta());
    toast({
      title: "Your page is live",
      description: "Test it once, then start sharing it.",
      variant: "success",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleCopyLink() {
    if (!publicUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicUrl);
      } else {
        const element = document.createElement("textarea");
        element.value = publicUrl;
        element.setAttribute("readonly", "");
        element.style.position = "absolute";
        element.style.left = "-9999px";
        document.body.appendChild(element);
        element.select();
        document.execCommand("copy");
        element.remove();
      }
      setShareTestComplete(true);
      toast({
        title: "Link copied",
        description: "Paste it anywhere you want to share your page.",
        variant: "success",
      });
      void trackEvent(
        "copy_public_link_clicked",
        trackingMeta({ public_url: publicUrl })
      );
    } catch {
      toast({
        title: "Copy failed",
        description: "Try copying the URL directly from your browser.",
        variant: "destructive",
      });
    }
  }

  function handleOpenLiveProfile() {
    if (!publicUrl) return;
    setShareTestComplete(true);
    void trackEvent(
      "open_public_profile_clicked",
      trackingMeta({ public_url: publicUrl })
    );
    window.open(publicUrl, "_blank", "noopener,noreferrer");
  }

  function handleOpenQr() {
    setQrOpen(true);
    void trackEvent("qr_modal_opened", trackingMeta({ public_url: publicUrl }));
  }

  function handleContinueToDashboard(path: string) {
    window.location.assign(path);
  }

  if (loading || !profileDraft || !contactDraft || !userId || !previewProfile) {
    return (
      <div className="min-h-[100svh] bg-[radial-gradient(circle_at_top_left,rgba(255,183,146,0.36),transparent_28%),radial-gradient(circle_at_top_right,rgba(125,211,252,0.22),transparent_28%),linear-gradient(180deg,#fffaf5_0%,#fffdfb_100%)] px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <Card className="rounded-[28px] border-white/70 bg-white/85 shadow-[0_28px_70px_-45px_rgba(15,23,42,0.28)]">
            <CardHeader>
              <Badge
                variant="outline"
                className="w-fit rounded-full border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600"
              >
                Get Started
              </Badge>
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">
                Loading your setup...
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                Preparing the fastest path to a live Linket page.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const currentStep = SETUP_STEPS[currentStepIndex];
  const checklistItems = [
    { label: "Profile basics", done: liveProfileReady },
    { label: "Contact card", done: contactReady },
    { label: "First link", done: linksReady },
    { label: "Publish page", done: publishReady },
    { label: "Test once", done: shareTestComplete },
  ];
  const previewDisplayName =
    profileDraft.name.trim() || account.displayName?.trim() || "Your Name";
  const stepHeading =
    currentStep.id === "profile"
      ? {
          title: "Profile",
          description: "Add the basics people see first.",
        }
      : currentStep.id === "contact"
        ? {
            title: "Contact card",
            description: "Add the details people should save first.",
          }
        : currentStep.id === "links"
          ? {
              title: "Links + theme",
              description:
                "Add the main actions first, then choose a look that fits.",
            }
          : publishReady
            ? {
                title: "Review + publish",
                description:
                  "Your page is already live. Make one quick check and keep moving.",
              }
            : {
                title: "Review + publish",
                description:
                  "Check the essentials, publish, and test your page once.",
              };
  const linkButtonLabel =
    profileDraft.links.length < 2 ? "Add optional link" : "Add another link";
  const autosaveToneClassName =
    profileSaveStatus === "error" ||
    contactSaveStatus === "error" ||
    saveError
      ? "border-red-200 bg-red-50 text-red-700"
      : profileSaveStatus === "saving" ||
          contactSaveStatus === "saving" ||
          profileSaveStatus === "publishing"
        ? "border-slate-200 bg-white text-slate-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="min-h-[100svh] bg-[radial-gradient(circle_at_top_left,rgba(255,183,146,0.34),transparent_27%),radial-gradient(circle_at_top_right,rgba(125,211,252,0.2),transparent_26%),linear-gradient(180deg,#fffaf5_0%,#fffdfb_100%)] px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="space-y-4 px-1">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Get your Linket page live
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Add the essentials, publish, and test once. You can refine everything
              else later.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className="rounded-full border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600"
            >
              Step {currentStepIndex + 1} of {SETUP_STEPS.length}
            </Badge>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600">
              <Clock3 className="h-4 w-4" />
              ~3 min
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
                autosaveToneClassName
              )}
            >
              {profileSaveStatus === "saving" ||
              contactSaveStatus === "saving" ||
              profileSaveStatus === "publishing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {autosaveLabel}
            </span>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="space-y-6">
            {showLaunchHub ? (
              <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.28)]">
                <CardHeader className="gap-3 border-b border-slate-200/80 pb-6">
                  <Badge className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-800">
                    You&apos;re live
                  </Badge>
                  <CardTitle className="text-3xl font-semibold tracking-tight text-slate-900">
                    Copy your link, open your page, or scan the QR once.
                  </CardTitle>
                  <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                    That quick check is the first win. Everything else can happen
                    after your page is already working.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-6 py-6 sm:px-8">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Button
                      type="button"
                      className="h-12 rounded-2xl text-sm"
                      onClick={handleCopyLink}
                    >
                      Copy link
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-2xl text-sm"
                      onClick={handleOpenLiveProfile}
                    >
                      Open live page
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-2xl text-sm"
                      onClick={handleOpenQr}
                    >
                      Show QR
                    </Button>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => {
                        void trackEvent(
                          "linket_claim_started",
                          trackingMeta({ source_cta: "launch_hub" })
                        );
                        handleContinueToDashboard("/dashboard/linkets");
                      }}
                      className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 text-left transition hover:border-slate-300 hover:bg-white"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        Claim a Linket
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Connect NFC hardware after your page is live.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleContinueToDashboard("/dashboard/leads")}
                      className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 text-left transition hover:border-slate-300 hover:bg-white"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        Turn on contact capture
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Add lead forms once people can already reach you.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleContinueToDashboard("/dashboard/overview")}
                      className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 text-left transition hover:border-slate-300 hover:bg-white"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        Continue to dashboard
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Go deeper into analytics, billing, and advanced settings.
                      </p>
                    </button>
                  </div>
                </CardContent>
              </Card>
            ) : (
                <Card className="rounded-[32px] border-white/70 bg-white/92 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.28)]">
                  <CardHeader className="gap-3 border-b border-slate-200/80 pb-6">
                    <CardTitle className="text-3xl font-semibold tracking-tight text-slate-900">
                      {stepHeading.title}
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                      {stepHeading.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 px-6 py-6 sm:px-8">
                    {currentStep.id === "profile" ? (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">
                              Profile photo
                            </p>
                            <p className="text-sm text-slate-500">
                              Upload a clear headshot or logo.
                            </p>
                          </div>
                          <AvatarUploader
                            userId={userId}
                            userEmail={userEmail}
                            avatarUrl={avatarPreviewUrl}
                            avatarOriginalFileName={account.avatarOriginalFileName}
                            variant="compact"
                            onUploaded={(payload) => {
                              const hasAvatar = Boolean(payload.path);
                              setAccount((current) => ({
                                ...current,
                                avatarPath: hasAvatar ? payload.path : null,
                                avatarUpdatedAt: hasAvatar ? payload.version : null,
                                avatarOriginalFileName:
                                  payload.originalFileName ?? null,
                              }));
                              setAvatarPreviewUrl(hasAvatar ? payload.publicUrl : null);
                              if (hasAvatar) {
                                void trackEvent("photo_uploaded", trackingMeta());
                              }
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="setup-name"
                            className="text-sm font-medium text-slate-800"
                          >
                            Name
                          </Label>
                          <Input
                            id="setup-name"
                            value={profileDraft.name}
                            placeholder="Jane Smith"
                            className="h-12 rounded-2xl border-slate-200 bg-white"
                            onChange={(event) => {
                              const nextName = event.target.value;
                              updateProfileDraft((current) => ({
                                ...current,
                                name: nextName,
                                handle:
                                  handleTouched || !userId
                                    ? current.handle
                                    : buildSuggestedHandle(nextName, userId),
                              }));
                              updateContactDraft((current) =>
                                current.fullName.trim()
                                  ? current
                                  : { ...current, fullName: nextName }
                              );
                            }}
                          />
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <Label
                              htmlFor="setup-handle"
                              className="text-sm font-medium text-slate-800"
                            >
                              Public URL
                            </Label>
                            {suggestedHandle &&
                            suggestedHandle !== sanitizeHandleInput(profileDraft.handle) ? (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-xs text-slate-500"
                                onClick={() => {
                                  setHandleTouched(false);
                                  updateProfileDraft((current) => ({
                                    ...current,
                                    handle: suggestedHandle,
                                  }));
                                }}
                              >
                                Use suggested slug
                              </Button>
                            ) : null}
                          </div>
                          <div className="space-y-3 rounded-[28px] border border-slate-200 bg-slate-50/80 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                              <span className="shrink-0 text-sm font-medium text-slate-500">
                                {DEFAULT_LINK_HOST}/
                              </span>
                              <Input
                                id="setup-handle"
                                value={profileDraft.handle}
                                placeholder="jane-smith"
                                className="h-12 rounded-2xl border-slate-200 bg-white"
                                onChange={(event) => {
                                  setHandleTouched(true);
                                  updateProfileDraft((current) => ({
                                    ...current,
                                    handle: sanitizeHandleInput(
                                      event.target.value
                                    ),
                                  }));
                                }}
                              />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <p className="text-slate-500">
                                Keep it short and easy to share.
                              </p>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-2 font-medium",
                                  handleStatus.className
                                )}
                              >
                                {handleStatus.label === "Checking..." ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                                {handleStatus.label}
                              </span>
                            </div>
                          </div>
                          {handleError ? (
                            <p className="text-sm text-red-600">{handleError}</p>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="setup-headline"
                            className="text-sm font-medium text-slate-800"
                          >
                            One-line intro
                          </Label>
                          <Textarea
                            id="setup-headline"
                            value={profileDraft.headline}
                            placeholder="Product designer helping startups simplify complex ideas."
                            className="min-h-24 rounded-2xl border-slate-200 bg-white"
                            onChange={(event) =>
                              updateProfileDraft((current) => ({
                                ...current,
                                headline: event.target.value,
                              }))
                            }
                          />
                          <p className="text-sm text-slate-500">
                            Tell people what you do in one sentence.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {currentStep.id === "contact" ? (
                      <div className="space-y-6">
                        <div className="grid gap-5 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label
                              htmlFor="setup-email"
                              className="text-sm font-medium text-slate-800"
                            >
                              Email
                            </Label>
                            <Input
                              id="setup-email"
                              type="email"
                              value={contactDraft.email}
                              placeholder="jane@company.com"
                              className="h-12 rounded-2xl border-slate-200 bg-white"
                              onChange={(event) =>
                                updateContactDraft((current) => ({
                                  ...current,
                                  email: event.target.value,
                                }))
                              }
                            />
                            <p className="text-sm text-slate-500">
                              One solid contact method is enough for this step.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="setup-phone"
                              className="text-sm font-medium text-slate-800"
                            >
                              Phone
                            </Label>
                            <Input
                              id="setup-phone"
                              type="tel"
                              value={contactDraft.phone}
                              placeholder="(555) 123-4567"
                              className="h-12 rounded-2xl border-slate-200 bg-white"
                              onChange={(event) =>
                                updateContactDraft((current) => ({
                                  ...current,
                                  phone: event.target.value,
                                }))
                              }
                            />
                            <p className="text-sm text-slate-500">
                              Add this too if people should be able to save it.
                            </p>
                          </div>
                        </div>
                        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Optional details
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Add these now if they matter. Otherwise keep moving.
                            </p>
                          </div>
                          <div className="grid gap-5 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label
                                htmlFor="setup-title"
                                className="text-sm font-medium text-slate-800"
                              >
                                Job title
                              </Label>
                              <Input
                                id="setup-title"
                                value={contactDraft.title}
                                placeholder="Founder"
                                className="h-12 rounded-2xl border-slate-200 bg-white"
                                onChange={(event) =>
                                  updateContactDraft((current) => ({
                                    ...current,
                                    title: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor="setup-company"
                                className="text-sm font-medium text-slate-800"
                              >
                                Company
                              </Label>
                              <Input
                                id="setup-company"
                                value={contactDraft.company}
                                placeholder="Linket"
                                className="h-12 rounded-2xl border-slate-200 bg-white"
                                onChange={(event) =>
                                  updateContactDraft((current) => ({
                                    ...current,
                                    company: event.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {currentStep.id === "links" ? (
                      <div className="space-y-8">
                        <div className="space-y-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                Your first link
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                Start with the button people should tap first. Add a
                                second one if it helps.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-2xl"
                              disabled={profileDraft.links.length >= MAX_LINK_ROWS}
                              onClick={() =>
                                updateProfileDraft((current) => ({
                                  ...current,
                                  links: [...current.links, buildEmptyLink()],
                                }))
                              }
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              {linkButtonLabel}
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {profileDraft.links.map((link, index) => (
                              <div
                                key={link.id || `setup-link-${index}`}
                                className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {index === 0
                                        ? "First link"
                                        : index === 1
                                          ? "Optional second link"
                                          : `Link ${index + 1}`}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                      {index === 0
                                        ? "Make this the main action on your page."
                                        : index === 1
                                          ? "Useful if you need one more destination."
                                          : "Add another destination if you need it."}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 rounded-2xl text-slate-500"
                                    disabled={profileDraft.links.length === 1}
                                    onClick={() =>
                                      updateProfileDraft((current) => {
                                        const nextLinks = current.links.filter(
                                          (_, itemIndex) => itemIndex !== index
                                        );
                                        return {
                                          ...current,
                                          links: nextLinks.length
                                            ? nextLinks
                                            : [buildEmptyLink()],
                                        };
                                      })
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-800">
                                      Button text
                                    </Label>
                                    <Input
                                      value={link.title}
                                      placeholder={
                                        index === 0 ? "Website" : "Instagram"
                                      }
                                      className="h-11 rounded-2xl border-slate-200 bg-white"
                                      onChange={(event) =>
                                        updateProfileDraft((current) => ({
                                          ...current,
                                          links: current.links.map(
                                            (item, itemIndex) =>
                                              itemIndex === index
                                                ? {
                                                    ...item,
                                                    title: event.target.value,
                                                  }
                                                : item
                                          ),
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-800">
                                      URL
                                    </Label>
                                    <Input
                                      value={link.url}
                                      placeholder={
                                        index === 0
                                          ? "yourwebsite.com"
                                          : "instagram.com/yourname"
                                      }
                                      className="h-11 rounded-2xl border-slate-200 bg-white"
                                      onChange={(event) =>
                                        updateProfileDraft((current) => ({
                                          ...current,
                                          links: current.links.map(
                                            (item, itemIndex) =>
                                              itemIndex === index
                                                ? {
                                                    ...item,
                                                    url: event.target.value,
                                                  }
                                                : item
                                          ),
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-slate-500" />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                Choose a theme
                              </p>
                              <p className="text-sm text-slate-500">
                                Pick a starting look. You can refine it later.
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {FEATURED_THEMES.map((themeOption) => {
                              const selected = profileDraft.theme === themeOption.value;
                              return (
                                <button
                                  key={themeOption.value}
                                  type="button"
                                  onClick={() => {
                                    setTheme(themeOption.value);
                                    updateProfileDraft((current) => ({
                                      ...current,
                                      theme: themeOption.value,
                                    }));
                                    void trackEvent(
                                      "theme_selected",
                                      trackingMeta({ theme: themeOption.value })
                                    );
                                  }}
                                  className={cn(
                                    "overflow-hidden rounded-3xl border text-left transition",
                                    selected
                                      ? "border-slate-900 bg-slate-900 text-white shadow-[0_18px_42px_-30px_rgba(15,23,42,0.45)]"
                                      : "border-slate-200 bg-white hover:border-slate-300"
                                  )}
                                >
                                  <div
                                    className={cn("h-24 w-full", themeOption.swatchClassName)}
                                  />
                                  <div className="space-y-1 px-4 py-4">
                                    <p className="text-sm font-semibold">
                                      {themeOption.label}
                                    </p>
                                    <p
                                      className={cn(
                                        "text-sm",
                                        selected ? "text-white/75" : "text-slate-500"
                                      )}
                                    >
                                      {themeOption.description}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {currentStep.id === "publish" ? (
                      <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                              Live URL
                            </p>
                            <p className="mt-2 break-all text-sm font-semibold text-slate-900">
                              {publicUrl}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              This becomes public as soon as you publish.
                            </p>
                          </div>
                          <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                              After publish
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              Copy the link, open the page, or pull up the QR once
                              to make sure everything works.
                            </p>
                          </div>
                        </div>
                        <div className="xl:hidden">
                          <SetupLivePreviewCard
                            avatarUrl={avatarPreviewUrl}
                            contactEnabled={contactReady}
                            displayName={previewDisplayName}
                            headline={profileDraft.headline}
                            links={previewProfile.links}
                            publicUrl={publicUrl}
                            theme={profileDraft.theme}
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                            <p className="text-sm font-semibold text-slate-900">
                              Ready to publish
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              You can keep editing after this. The goal is to get a
                              clean, usable page live now.
                            </p>
                          </div>
                          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                            <p className="text-sm font-semibold text-slate-900">
                              QR
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {publishReady
                                ? "Your QR is ready. Open it and test the page on a phone."
                                : "Your QR is ready as soon as the page is published."}
                            </p>
                            {publishReady ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="mt-4 rounded-2xl"
                                onClick={handleOpenQr}
                              >
                                Show QR
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {stepError ? <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{stepError}</div> : null}
                    {saveError && !stepError ? <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{saveError}</div> : null}

                    <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 rounded-2xl text-sm"
                        disabled={currentStepIndex === 0}
                        onClick={() => {
                          setCurrentStepIndex((current) => Math.max(current - 1, 0));
                          setStepError(null);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Back
                      </Button>
                      {currentStep.id === "publish" ? (
                        <Button
                          type="button"
                          className="h-12 rounded-2xl px-6 text-sm"
                          disabled={profileSaveStatus === "publishing"}
                          onClick={() => void handlePublish()}
                        >
                          {profileSaveStatus === "publishing"
                            ? "Publishing..."
                            : publishReady
                              ? "Update live page"
                              : "Publish page"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className="h-12 rounded-2xl px-6 text-sm"
                          onClick={() => void handleContinue()}
                        >
                          Continue
                        </Button>
                      )}
                    </div>
                  </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4 lg:sticky lg:top-6">
            <Card className="rounded-[32px] border-white/70 bg-white/88 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.24)]">
              <CardHeader className="gap-2 border-b border-slate-200/80 pb-5">
                <CardTitle className="text-lg font-semibold text-slate-900">Live preview</CardTitle>
                <CardDescription className="text-sm text-slate-600">A compact view of what will go public.</CardDescription>
              </CardHeader>
              <CardContent className="px-5 py-5">
                <SetupLivePreviewCard
                  avatarUrl={avatarPreviewUrl}
                  contactEnabled={contactReady}
                  displayName={previewDisplayName}
                  headline={profileDraft.headline}
                  links={previewProfile.links}
                  publicUrl={publicUrl}
                  theme={profileDraft.theme}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-white/70 bg-white/88 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.24)]">
              <CardHeader className="gap-2 border-b border-slate-200/80 pb-5">
                <CardTitle className="text-lg font-semibold text-slate-900">Checklist</CardTitle>
                <CardDescription className="text-sm text-slate-600">Keep the form focused. Keep the motivation here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-5 py-5">
                {checklistItems.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3",
                      item.done
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50/80"
                    )}
                  >
                    <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full", item.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500")}><Check className="h-4 w-4" /></span>
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-md rounded-[28px] border-white/70 bg-white/95 p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-slate-900">Share this QR</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-600">Scan this on a phone to test your live page or use it in person.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="mx-auto w-fit rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicUrl)}`} alt="QR code for your live profile" width={220} height={220} className="h-[220px] w-[220px] rounded-2xl" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">{publicUrl}</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
