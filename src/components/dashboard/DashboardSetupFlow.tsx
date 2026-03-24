"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Link2,
  Loader2,
  Mail,
  Palette,
  Phone,
  Plus,
  Rocket,
  Smartphone,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import AvatarUploader from "@/components/dashboard/AvatarUploader";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import PhonePreviewCard, {
  type PhonePreviewLinkItem,
} from "@/components/dashboard/public-profile/PhonePreviewCard";
import { toast } from "@/components/system/toaster";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { trackEvent } from "@/lib/analytics";
import { getSignedAvatarUrl } from "@/lib/avatar-client";
import { getSignedProfileHeaderUrl } from "@/lib/profile-header-client";
import { getSignedProfileLogoUrl } from "@/lib/profile-logo-client";
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
const PROFILE_EDITOR_SECTION_STORAGE_KEY =
  "linket:profile-editor:active-section";

const SETUP_STEPS: Array<{
  id: SetupStepId;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "profile",
    label: "Profile",
    description: "Photo, name, public URL, and intro",
    icon: UserRound,
  },
  {
    id: "contact",
    label: "Contact card",
    description: "How people save you",
    icon: Phone,
  },
  {
    id: "links",
    label: "Links + theme",
    description: "Add your first buttons, then choose a look",
    icon: Link2,
  },
  {
    id: "publish",
    label: "Review + publish",
    description: "Go live and test once",
    icon: Rocket,
  },
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

function mapOnboardingStateProfile(
  state: DashboardOnboardingState
): ProfileDraft {
  const now = new Date().toISOString();
  return prepareSetupLinks(
    {
      id: state.activeProfile.id ?? "preview-profile",
      name: state.activeProfile.name ?? "",
      handle: state.activeProfile.handle ?? "",
      headline: state.activeProfile.headline ?? "",
      headerImageUrl: null,
      headerImageUpdatedAt: null,
      headerImageOriginalFileName: null,
      logoUrl: null,
      logoUpdatedAt: null,
      logoOriginalFileName: null,
      logoShape: "circle",
      logoBackgroundWhite: false,
      links:
        state.activeProfile.links?.map((link) => ({
          id: link.id,
          title: link.title ?? "",
          url: link.url ?? "",
          isActive: link.is_active ?? true,
          isOverride: link.is_override ?? false,
        })) ?? [],
      theme: normalizeThemeName(state.activeProfile.theme, "autumn"),
      active: state.activeProfile.isActive,
      createdAt: now,
      updatedAt: now,
    },
    state.publishEventCount
  );
}

function mapOnboardingStateContact(
  state: DashboardOnboardingState,
  fallbackName: string,
  fallbackEmail: string | null
): ContactDraft {
  const mappedContact = mapContactFields(state.contact, fallbackName);
  if (
    !mappedContact.email.trim() &&
    !mappedContact.phone.trim() &&
    fallbackEmail
  ) {
    return {
      ...mappedContact,
      email: fallbackEmail,
    };
  }
  return mappedContact;
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

function getDraftLinkFieldKey(link: ProfileLinkDraft, index: number) {
  return link.id ?? `draft-link-${index}`;
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

export default function DashboardSetupFlow({
  initialOnboardingState,
  previewMode = false,
}: {
  initialOnboardingState: DashboardOnboardingState;
  previewMode?: boolean;
}) {
  const user = useDashboardUser();
  const { setTheme } = useThemeOptional();
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;
  const previewProfileDraft = useMemo(
    () => mapOnboardingStateProfile(initialOnboardingState),
    [initialOnboardingState]
  );
  const previewContactDraft = useMemo(
    () =>
      mapOnboardingStateContact(
        initialOnboardingState,
        previewProfileDraft.name,
        userEmail
      ),
    [initialOnboardingState, previewProfileDraft.name, userEmail]
  );
  const [loading, setLoading] = useState(!previewMode);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(
    previewMode ? previewProfileDraft : null
  );
  const [contactDraft, setContactDraft] = useState<ContactDraft | null>(
    previewMode ? previewContactDraft : null
  );
  const [account, setAccount] = useState<AccountDraft>({
    handle: initialOnboardingState.activeProfile.handle,
    avatarPath: initialOnboardingState.account.avatarPath,
    avatarUpdatedAt: initialOnboardingState.account.avatarUpdatedAt,
    avatarOriginalFileName: null,
    displayName: initialOnboardingState.account.displayName,
  });
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
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
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [showContactExtras, setShowContactExtras] = useState(false);
  const [showPhoneField, setShowPhoneField] = useState(false);
  const [showThemeChooser, setShowThemeChooser] = useState(false);
  const [expandedLinkTitleEditors, setExpandedLinkTitleEditors] = useState<
    Record<string, boolean>
  >({});

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
    if (!contactDraft) return;
    if (contactDraft.title.trim() || contactDraft.company.trim()) {
      setShowContactExtras(true);
    }
  }, [contactDraft]);

  useEffect(() => {
    if (!contactDraft) return;
    if (contactDraft.phone.trim()) {
      setShowPhoneField(true);
    }
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
    let active = true;
    (async () => {
      if (!profileDraft?.headerImageUrl) {
        if (active) setHeaderPreviewUrl(null);
        return;
      }
      const signed = await getSignedProfileHeaderUrl(
        profileDraft.headerImageUrl,
        profileDraft.headerImageUpdatedAt
      );
      if (active) setHeaderPreviewUrl(signed);
    })();
    return () => {
      active = false;
    };
  }, [profileDraft?.headerImageUpdatedAt, profileDraft?.headerImageUrl]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!profileDraft?.logoUrl) {
        if (active) setLogoPreviewUrl(null);
        return;
      }
      const signed = await getSignedProfileLogoUrl(
        profileDraft.logoUrl,
        profileDraft.logoUpdatedAt
      );
      if (active) setLogoPreviewUrl(signed);
    })();
    return () => {
      active = false;
    };
  }, [profileDraft?.logoUpdatedAt, profileDraft?.logoUrl]);

  useEffect(() => {
    if (!previewMode) return;
    setProfileDraft(previewProfileDraft);
    setContactDraft(previewContactDraft);
    setHandleTouched(!isAutoHandle(previewProfileDraft.handle));
    savedProfileSignatureRef.current =
      buildProfileDraftSignature(previewProfileDraft);
    savedContactSignatureRef.current = buildContactDraftSignature(
      previewContactDraft,
      previewProfileDraft.name
    );
    setTheme(previewProfileDraft.theme);
    setLoading(false);
  }, [previewContactDraft, previewMode, previewProfileDraft, setTheme]);

  useEffect(() => {
    if (previewMode) return;
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
        const seededContact =
          !mappedContact.email.trim() &&
          !mappedContact.phone.trim() &&
          userEmail
            ? { ...mappedContact, email: userEmail }
            : mappedContact;

        if (cancelled) return;

        setProfileDraft(mappedProfile);
        setContactDraft(seededContact);
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
          seededContact,
          mappedProfile.name
        );
        setTheme(mappedProfile.theme);
        setCurrentStepIndex(
          getInitialStepIndex({
            profileComplete:
              Boolean(mappedProfile.name.trim()) &&
              !isAutoHandle(mappedProfile.handle),
            contactComplete: Boolean(
              seededContact.email.trim() || seededContact.phone.trim()
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
    userEmail,
    userId,
    previewMode,
  ]);

  const liveProfileReady =
    Boolean(profileDraft?.name.trim()) &&
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
      return "Saving changes";
    }
    if (
      profileSaveStatus === "error" ||
      contactSaveStatus === "error" ||
      saveError
    ) {
      return "Needs attention";
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
        label: "Add your link",
        className: "text-muted-foreground",
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
        label: "Choose your link",
        className: "text-amber-700",
      };
    }
    if (profileSaveStatus === "saving" || profileHasUnsavedChanges) {
      return {
        label: "Checking...",
        className: "text-muted-foreground",
      };
    }
    return {
      label: "Ready",
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
          setAccount((current) => ({
            ...current,
            handle: savedRecord.handle,
          }));

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("linket:handle-updated", {
                detail: { handle: savedRecord.handle },
              })
            );
          }

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

  function focusFieldById(id: string) {
    if (typeof document === "undefined") return;
    window.setTimeout(() => {
      const element = document.getElementById(id);
      if (element instanceof HTMLElement) {
        element.focus();
      }
    }, 40);
  }

  function focusFirstMissingField(stepId: SetupStepId) {
    if (stepId === "profile") {
      if (!profileDraftRef.current?.name.trim()) {
        focusFieldById("setup-name");
        return;
      }
      if (
        !profileDraftRef.current?.handle.trim() ||
        isAutoHandle(profileDraftRef.current.handle)
      ) {
        focusFieldById("setup-handle");
      }
      return;
    }
    if (stepId === "contact") {
      if (!contactDraftRef.current?.email.trim() && !contactDraftRef.current?.phone.trim()) {
        focusFieldById("setup-email");
      }
      return;
    }
    if (stepId === "links") {
      if (
        !profileDraftRef.current?.links.some((link) => isMeaningfulLink(link.url))
      ) {
        focusFieldById("setup-link-url-0");
      }
    }
  }

  function validateStep(stepIndex: number) {
    switch (SETUP_STEPS[stepIndex]?.id) {
      case "profile":
        if (!profileDraft?.name.trim()) {
          return "Add your name to continue.";
        }
        if (!profileDraft.handle.trim() || isAutoHandle(profileDraft.handle)) {
          return "Choose your public link to continue.";
        }
        return null;
      case "contact":
        if (!contactDraft?.email.trim() && !contactDraft?.phone.trim()) {
          return "Add an email or phone number to continue.";
        }
        return null;
      case "links":
        if (!profileDraft?.links.some((link) => isMeaningfulLink(link.url))) {
          return "Add your first link to continue.";
        }
        return null;
      default:
        if (!liveProfileReady) return "Finish your profile first.";
        if (!contactReady) return "Add contact details before you publish.";
        if (!linksReady) return "Add your first link before you publish.";
        return null;
    }
  }

  async function handleContinue() {
    const error = validateStep(currentStepIndex);
    if (error) {
      setStepError(error);
      focusFirstMissingField(currentStep.id);
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
      if (!liveProfileReady) {
        setCurrentStepIndex(0);
        focusFirstMissingField("profile");
      } else if (!contactReady) {
        setCurrentStepIndex(1);
        focusFirstMissingField("contact");
      } else if (!linksReady) {
        setCurrentStepIndex(2);
        focusFirstMissingField("links");
      }
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

  function handleBackStep() {
    setCurrentStepIndex((current) => Math.max(current - 1, 0));
    setStepError(null);
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

  function handleOpenProfileSection(
    section: "profile" | "contact" | "links" | "lead" | "preview"
  ) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROFILE_EDITOR_SECTION_STORAGE_KEY, section);
    }
    handleContinueToDashboard("/dashboard/profiles");
  }

  if (loading || !profileDraft || !contactDraft || !userId || !previewProfile) {
    return (
      <div className="min-h-[100svh] bg-[var(--background)] px-4 py-8 text-foreground sm:px-6 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <Card className="rounded-[28px] border-border/60 bg-card/90 shadow-[0_28px_70px_-45px_rgba(15,23,42,0.28)]">
            <CardHeader>
              <Badge
                variant="outline"
                className="w-fit rounded-full border-border/60 bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
              >
                Get Started
              </Badge>
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                Loading your setup...
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Preparing the fastest path to a live Linket page.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const currentStep = SETUP_STEPS[currentStepIndex];
  const progressValue = ((currentStepIndex + 1) / SETUP_STEPS.length) * 100;
  const fieldLabelClassName = "text-sm font-medium text-foreground";
  const fieldHelperClassName = "text-sm text-muted-foreground";
  const fieldInputClassName =
    "h-12 rounded-2xl border-border/60 bg-background text-foreground";
  const compactFieldInputClassName =
    "h-11 rounded-2xl border-border/60 bg-background text-foreground";
  const setupCardClassName =
    "rounded-[28px] border-border/60 bg-card/95 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.28)]";
  const softPanelClassName =
    "rounded-2xl border border-border/60 bg-background/40";
  const checklistItems = [
    { label: "Profile basics", done: liveProfileReady, icon: UserRound },
    { label: "Contact card", done: contactReady, icon: Mail },
    { label: "First link", done: linksReady, icon: Link2 },
    { label: "Publish page", done: publishReady, icon: Rocket },
    { label: "Test once", done: shareTestComplete, icon: Smartphone },
  ];
  const previewDisplayName =
    profileDraft.name.trim() || account.displayName?.trim() || "Your Name";
  const previewTagline =
    profileDraft.headline.trim() || "Your one-line intro will show here.";
  const previewLinks: PhonePreviewLinkItem[] = previewProfile.links.map((link) => ({
    id: link.id,
    label: link.title,
    url: link.url,
    visible: link.is_active,
    isOverride: link.is_override,
    clicks: link.click_count ?? 0,
  }));
  const selectedThemeOption =
    FEATURED_THEMES.find((themeOption) => themeOption.value === profileDraft.theme) ??
    FEATURED_THEMES[0];
  const canChooseTheme = linksReady;
  const stepHeading =
    currentStep.id === "profile"
      ? {
          title: "Profile",
          description: "Add what people see first.",
        }
      : currentStep.id === "contact"
        ? {
            title: "Contact card",
            description: "Add the details people can save.",
          }
        : currentStep.id === "links"
          ? {
              title: "Links + theme",
              description: "Add your links, then pick a look.",
            }
          : publishReady
            ? {
                title: "Review + publish",
                description: "Your page is live. Test it once and keep going.",
              }
            : {
                title: "Review + publish",
                description: "Review, publish, and test once.",
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
        ? "border-border/60 bg-card text-foreground"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const mobilePrimaryActionLabel =
    currentStep.id === "publish"
      ? profileSaveStatus === "publishing"
        ? "Publishing..."
        : publishReady
          ? "Update live page"
          : "Publish page"
      : "Continue";

  return (
    <div className="dashboard-overview-page min-h-[100svh] bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+8.5rem)] pt-4 text-foreground sm:px-6 sm:py-5 lg:px-10 lg:py-6">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-5">
        <header className="dashboard-overview-header flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
          <div className="dashboard-overview-intro max-w-3xl space-y-2">
            <h1 className="text-[2rem] font-semibold tracking-tight text-foreground sm:text-4xl">
              Get your Linket page live
            </h1>
            <p className="max-w-2xl text-sm leading-5 text-muted-foreground sm:text-base sm:leading-6">
              Add the essentials, publish, and test once. You can refine everything
              else later.
            </p>
          </div>
          <div className="w-full max-w-xl space-y-2">
            <div className="flex flex-wrap items-center gap-2 max-[359px]:gap-1.5">
              <Badge
                variant="outline"
                className="rounded-full border-border/60 bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
              >
                Step {currentStepIndex + 1} of {SETUP_STEPS.length}
              </Badge>
              <span className="dashboard-date-pill hidden items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-sm text-muted-foreground shadow-sm min-[401px]:inline-flex">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                ~3 min
              </span>
              <span
                aria-live="polite"
                aria-atomic="true"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
                  autosaveToneClassName
                )}
              >
                {profileSaveStatus === "saving" ||
                contactSaveStatus === "saving" ||
                profileSaveStatus === "publishing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                {autosaveLabel}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Onboarding progress"
              aria-valuemin={1}
              aria-valuemax={SETUP_STEPS.length}
              aria-valuenow={currentStepIndex + 1}
              aria-valuetext={`Step ${currentStepIndex + 1} of ${SETUP_STEPS.length}`}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        </header>

        {!showLaunchHub ? (
          <Card className={cn(setupCardClassName, "lg:hidden")}>
            <CardContent className="flex items-center justify-between gap-3 px-4 py-3 max-[359px]:flex-col max-[359px]:items-stretch">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {stepHeading.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stepHeading.description}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 rounded-2xl px-3 text-sm max-[359px]:w-full"
                onClick={() => setMobilePreviewOpen(true)}
              >
                <span className="inline-flex items-center gap-2">
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                  Preview
                </span>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_332px] lg:items-start xl:gap-6 xl:grid-cols-[minmax(0,1fr)_348px]">
          <div className="space-y-5">
            {showLaunchHub ? (
              <Card className={setupCardClassName}>
                <CardHeader className="gap-2 border-b border-border/60 pb-5">
                  <CardTitle className="text-3xl font-semibold tracking-tight text-foreground">
                    You&apos;re live
                  </CardTitle>
                  <CardDescription className="max-w-2xl text-sm text-muted-foreground">
                    Copy your link, open your page, or scan the QR once.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 px-5 py-5 sm:px-6">
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
                      className={cn("p-4 text-left transition hover:border-border hover:bg-card", softPanelClassName)}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        Claim a Linket
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Connect hardware next.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenProfileSection("lead")}
                      className={cn("p-4 text-left transition hover:border-border hover:bg-card", softPanelClassName)}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        Turn on lead capture
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Open the lead form builder.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleContinueToDashboard("/dashboard/overview")}
                      className={cn("p-4 text-left transition hover:border-border hover:bg-card", softPanelClassName)}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        Go to dashboard
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Keep refining anytime.
                      </p>
                    </button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className={setupCardClassName}>
                  <CardHeader className="gap-2 border-b border-border/60 pb-4">
                    <p className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:block">
                      Step {currentStepIndex + 1}
                    </p>
                    <CardTitle className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      {stepHeading.title}
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-sm text-muted-foreground">
                      {stepHeading.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 px-5 py-5 sm:px-6">
                    {currentStep.id === "profile" ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              Profile photo
                            </p>
                            <p className={fieldHelperClassName}>
                              Add one now or later.
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
                            className={fieldLabelClassName}
                          >
                            Name
                          </Label>
                          <Input
                            id="setup-name"
                            value={profileDraft.name}
                            placeholder="Jane Smith"
                            className={fieldInputClassName}
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

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <Label
                              htmlFor="setup-handle"
                              className={fieldLabelClassName}
                            >
                              Public URL
                            </Label>
                            {suggestedHandle &&
                            suggestedHandle !== sanitizeHandleInput(profileDraft.handle) ? (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-xs text-muted-foreground"
                                onClick={() => {
                                  setHandleTouched(false);
                                  updateProfileDraft((current) => ({
                                    ...current,
                                    handle: suggestedHandle,
                                  }));
                                }}
                              >
                                Use suggestion
                              </Button>
                            ) : null}
                          </div>
                          <div className={cn("space-y-3 p-3.5", softPanelClassName)}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                              <span className="shrink-0 text-sm font-medium text-muted-foreground">
                                {DEFAULT_LINK_HOST}/
                              </span>
                              <Input
                                id="setup-handle"
                                value={profileDraft.handle}
                                placeholder="jane-smith"
                                className={fieldInputClassName}
                                aria-invalid={Boolean(handleError)}
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
                              <p className="text-muted-foreground">
                                Short is easiest to share.
                              </p>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-2 font-medium",
                                  handleStatus.className
                                )}
                              >
                                {handleStatus.label === "Checking..." ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : handleStatus.label === "Ready" ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <Link2 className="h-4 w-4" />
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
                            className={fieldLabelClassName}
                          >
                            One-line intro
                          </Label>
                          <Textarea
                            id="setup-headline"
                            value={profileDraft.headline}
                            placeholder="Product designer helping startups simplify complex ideas."
                            className="min-h-20 rounded-2xl border-border/60 bg-background text-foreground"
                            onChange={(event) =>
                              updateProfileDraft((current) => ({
                                ...current,
                                headline: event.target.value,
                              }))
                            }
                          />
                          <p className={fieldHelperClassName}>
                            One sentence is enough.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {currentStep.id === "contact" ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <Label
                              htmlFor="setup-email"
                              className={fieldLabelClassName}
                            >
                              Email
                            </Label>
                            {userEmail &&
                            !contactDraft.email.trim() &&
                            userEmail !== contactDraft.email ? (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-xs text-muted-foreground"
                                onClick={() =>
                                  updateContactDraft((current) => ({
                                    ...current,
                                    email: userEmail,
                                  }))
                                }
                              >
                                Use account email
                              </Button>
                            ) : null}
                          </div>
                          <Input
                            id="setup-email"
                            type="email"
                            value={contactDraft.email}
                            placeholder="jane@company.com"
                            className={fieldInputClassName}
                            onChange={(event) =>
                              updateContactDraft((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                          />
                          <p className={fieldHelperClassName}>
                            Add one way to reach you.
                          </p>
                        </div>
                        {showPhoneField ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <Label
                                htmlFor="setup-phone"
                                className={fieldLabelClassName}
                              >
                                Phone
                              </Label>
                              {!contactDraft.phone.trim() ? (
                                <Button
                                  type="button"
                                  variant="link"
                                  className="h-auto p-0 text-xs text-muted-foreground"
                                  onClick={() => setShowPhoneField(false)}
                                >
                                  Hide
                                </Button>
                              ) : null}
                            </div>
                            <Input
                              id="setup-phone"
                              type="tel"
                              value={contactDraft.phone}
                              placeholder="(555) 123-4567"
                              className={fieldInputClassName}
                              onChange={(event) =>
                                updateContactDraft((current) => ({
                                  ...current,
                                  phone: event.target.value,
                                }))
                              }
                            />
                            <p className={fieldHelperClassName}>
                              Optional.
                            </p>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-12 w-full rounded-2xl justify-between px-4 text-sm"
                            onClick={() => setShowPhoneField(true)}
                          >
                            Add phone
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                        {showContactExtras ? (
                          <div className={cn("space-y-3 p-4", softPanelClassName)}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  More details
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                className="rounded-2xl text-sm"
                                onClick={() => setShowContactExtras(false)}
                              >
                                Hide extras
                              </Button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label
                                  htmlFor="setup-title"
                                  className={fieldLabelClassName}
                                >
                                  Job title
                                </Label>
                                <Input
                                  id="setup-title"
                                  value={contactDraft.title}
                                  placeholder="Founder"
                                  className={fieldInputClassName}
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
                                  className={fieldLabelClassName}
                                >
                                  Company
                                </Label>
                                <Input
                                  id="setup-company"
                                  value={contactDraft.company}
                                  placeholder="Linket"
                                  className={fieldInputClassName}
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
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-12 w-full rounded-2xl justify-between px-4 text-sm"
                            onClick={() => setShowContactExtras(true)}
                          >
                            Add more details
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : null}

                    {currentStep.id === "links" ? (
                      <div className="space-y-5">
                        <div className="space-y-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                Links
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Add the main place you want people to visit.
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
                              (() => {
                                const linkFieldKey = getDraftLinkFieldKey(link, index);
                                const showTitleField =
                                  Boolean(link.title.trim()) ||
                                  Boolean(expandedLinkTitleEditors[linkFieldKey]);

                                return (
                                  <div
                                    key={link.id || `setup-link-${index}`}
                                    className={cn("space-y-3 p-4", softPanelClassName)}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground">
                                          {index === 0
                                            ? "First link"
                                            : index === 1
                                              ? "Optional second link"
                                              : `Link ${index + 1}`}
                                        </p>
                                      </div>
                                      {profileDraft.links.length > 1 ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-11 w-11 rounded-2xl text-muted-foreground"
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
                                      ) : null}
                                    </div>
                                    <div
                                      className={cn(
                                        "grid gap-3",
                                        showTitleField
                                          ? "md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]"
                                          : ""
                                      )}
                                    >
                                      {showTitleField ? (
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between gap-3">
                                            <Label
                                              htmlFor={`setup-link-title-${index}`}
                                              className={fieldLabelClassName}
                                            >
                                              Button text
                                            </Label>
                                            {!link.title.trim() ? (
                                              <Button
                                                type="button"
                                                variant="link"
                                                className="h-auto p-0 text-xs text-muted-foreground"
                                                onClick={() =>
                                                  setExpandedLinkTitleEditors((current) => ({
                                                    ...current,
                                                    [linkFieldKey]: false,
                                                  }))
                                                }
                                              >
                                                Hide
                                              </Button>
                                            ) : null}
                                          </div>
                                          <Input
                                            id={`setup-link-title-${index}`}
                                            value={link.title}
                                            placeholder={
                                              index === 0 ? "Website" : "Instagram"
                                            }
                                            className={compactFieldInputClassName}
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
                                      ) : null}
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-3">
                                          <Label
                                            htmlFor={`setup-link-url-${index}`}
                                            className={fieldLabelClassName}
                                          >
                                            URL
                                          </Label>
                                          {!showTitleField ? (
                                            <Button
                                              type="button"
                                              variant="link"
                                              className="h-auto p-0 text-xs text-muted-foreground"
                                              onClick={() =>
                                                setExpandedLinkTitleEditors((current) => ({
                                                  ...current,
                                                  [linkFieldKey]: true,
                                                }))
                                              }
                                            >
                                              Add custom text
                                            </Button>
                                          ) : null}
                                        </div>
                                        <Input
                                          id={`setup-link-url-${index}`}
                                          value={link.url}
                                          placeholder={
                                            index === 0
                                              ? "yourwebsite.com"
                                              : "instagram.com/yourname"
                                          }
                                          className={compactFieldInputClassName}
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
                                        {!showTitleField ? (
                                          <p className="text-sm text-muted-foreground">
                                            We&apos;ll name the button from the link.
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                Theme
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Pick one. Change it anytime.
                              </p>
                            </div>
                          </div>
                          {canChooseTheme ? (
                            <div className={cn("space-y-3 p-4", softPanelClassName)}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">
                                    {selectedThemeOption.label}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-9 rounded-2xl px-3 text-sm"
                                  onClick={() =>
                                    setShowThemeChooser((current) => !current)
                                  }
                                >
                                  {showThemeChooser ? "Hide" : "Choose"}
                                </Button>
                              </div>
                              {showThemeChooser ? (
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {FEATURED_THEMES.map((themeOption) => {
                                    const selected = profileDraft.theme === themeOption.value;
                                    return (
                                      <button
                                        key={themeOption.value}
                                        type="button"
                                        onClick={() => {
                                          setTheme(themeOption.value);
                                          setShowThemeChooser(false);
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
                                          "overflow-hidden rounded-2xl border text-left transition",
                                          selected
                                            ? "border-foreground bg-foreground text-background shadow-[0_18px_42px_-30px_rgba(15,23,42,0.45)]"
                                            : "border-border/60 bg-card hover:border-border"
                                        )}
                                      >
                                        <div
                                          className={cn("h-20 w-full", themeOption.swatchClassName)}
                                        />
                                        <div className="px-3 py-3">
                                          <p className="text-sm font-semibold">
                                            {themeOption.label}
                                          </p>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className={cn("p-4", softPanelClassName)}>
                              <p className="text-sm font-medium text-foreground">
                                Add your first link first.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {currentStep.id === "publish" ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
                          <div className={cn("p-4", softPanelClassName)}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                              Live URL
                            </p>
                            <p className="mt-2 break-all text-sm font-semibold text-foreground">
                              {publicUrl}
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">
                              This is your live link.
                            </p>
                          </div>
                          <div className={cn("p-4", softPanelClassName)}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                              Test once
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">
                              Open it once on your phone.
                            </p>
                          </div>
                        </div>
                        <div className="hidden sm:block xl:hidden">
                          <div className="mx-auto w-full max-w-[300px]">
                            <PhonePreviewCard
                              profile={{
                                name: previewDisplayName,
                                tagline: previewTagline,
                              }}
                              avatarUrl={avatarPreviewUrl}
                              headerImageUrl={headerPreviewUrl}
                              logoUrl={logoPreviewUrl}
                              logoShape={profileDraft.logoShape}
                              logoBackgroundWhite={profileDraft.logoBackgroundWhite}
                              themeName={profileDraft.theme}
                              contactEnabled={contactReady}
                              contactDisabledText="Add email or phone"
                              links={previewLinks}
                              showLeadFormSection={false}
                              showClicks={false}
                            />
                          </div>
                        </div>
                        <div className={cn("flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between", softPanelClassName)}>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Publish now. Edit later.
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {publishReady
                                ? "QR is ready when you need it."
                                : "QR shows up after publish."}
                            </p>
                          </div>
                          {publishReady ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-2xl"
                              onClick={handleOpenQr}
                            >
                              Show QR
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {stepError ? (
                      <div
                        role="alert"
                        className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                      >
                        {stepError}
                      </div>
                    ) : null}
                    {saveError && !stepError ? (
                      <div
                        role="alert"
                        className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                      >
                        {saveError}
                      </div>
                    ) : null}

                    <div className="hidden border-t border-border/60 pt-5 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      {currentStepIndex > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-11 rounded-2xl text-sm"
                          onClick={handleBackStep}
                        >
                          Back
                        </Button>
                      ) : (
                        <div className="hidden h-11 sm:block" />
                      )}
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

          <aside className="hidden space-y-3 lg:sticky lg:top-5 lg:block" aria-label="Setup preview and checklist">
            <Card className={setupCardClassName}>
              <CardHeader className="gap-1 border-b border-border/60 pb-4">
                <CardTitle className="text-lg font-semibold text-foreground">Preview</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  What people will see.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 py-4">
                <div className="rounded-2xl border border-border/60 bg-muted/40 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Public URL
                  </p>
                  <p className="mt-1 break-all text-sm font-medium text-foreground">
                    {publicUrl}
                  </p>
                </div>
                <div className="mx-auto w-full max-w-[304px]">
                  <PhonePreviewCard
                    profile={{
                      name: previewDisplayName,
                      tagline: previewTagline,
                    }}
                    avatarUrl={avatarPreviewUrl}
                    headerImageUrl={headerPreviewUrl}
                    logoUrl={logoPreviewUrl}
                    logoShape={profileDraft.logoShape}
                    logoBackgroundWhite={profileDraft.logoBackgroundWhite}
                    themeName={profileDraft.theme}
                    contactEnabled={contactReady}
                    contactDisabledText="Add email or phone"
                    links={previewLinks}
                    showLeadFormSection={false}
                    showClicks={false}
                  />
                </div>
                <div className="space-y-2 border-t border-border/60 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Checklist
                  </p>
                {checklistItems.map((item) => (
                  (() => {
                    const ItemIcon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-3 px-1 py-1.5"
                      >
                        <span
                          className={cn(
                            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                            item.done
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-border/60 bg-background text-muted-foreground"
                          )}
                        >
                          <ItemIcon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                      </div>
                    );
                  })()
                ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <Dialog open={mobilePreviewOpen} onOpenChange={setMobilePreviewOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[21rem] rounded-[24px] border-border/60 bg-card/95 p-4 sm:max-w-md sm:p-5 lg:hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">
              Preview
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/60 bg-muted/40 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Public URL
              </p>
              <p className="mt-1 break-all text-sm font-medium text-foreground">
                {publicUrl}
              </p>
            </div>
            <div className="mx-auto w-full max-w-[264px] sm:max-w-[300px]">
              <PhonePreviewCard
                profile={{
                  name: previewDisplayName,
                  tagline: previewTagline,
                }}
                avatarUrl={avatarPreviewUrl}
                headerImageUrl={headerPreviewUrl}
                logoUrl={logoPreviewUrl}
                logoShape={profileDraft.logoShape}
                logoBackgroundWhite={profileDraft.logoBackgroundWhite}
                themeName={profileDraft.theme}
                contactEnabled={contactReady}
                contactDisabledText="Add email or phone"
                links={previewLinks}
                showLeadFormSection={false}
                showClicks={false}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-md rounded-[28px] border-border/60 bg-card/95 p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-foreground">Share this QR</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">Scan this on a phone to test your live page or use it in person.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="mx-auto w-fit rounded-[28px] border border-border/60 bg-background p-4 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicUrl)}`} alt="QR code for your live profile" width={220} height={220} className="h-[220px] w-[220px] rounded-2xl" />
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-foreground">{publicUrl}</div>
          </div>
        </DialogContent>
      </Dialog>

      {!showLaunchHub ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-18px_42px_-32px_rgba(15,23,42,0.4)] backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-7xl gap-3 max-[359px]:flex-col">
            {currentStepIndex > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 flex-1 rounded-2xl text-sm max-[359px]:w-full"
                onClick={handleBackStep}
              >
                Back
              </Button>
            ) : null}
            <Button
              type="button"
              className={cn(
                "h-12 rounded-2xl text-sm",
                currentStepIndex > 0
                  ? "flex-1 max-[359px]:w-full"
                  : "w-full"
              )}
              disabled={
                currentStep.id === "publish" &&
                profileSaveStatus === "publishing"
              }
              onClick={() =>
                currentStep.id === "publish"
                  ? void handlePublish()
                  : void handleContinue()
              }
            >
              {mobilePrimaryActionLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
