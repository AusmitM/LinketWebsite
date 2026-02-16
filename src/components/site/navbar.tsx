"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowUpRight,
  Bell,
  IdCard,
  Link2,
  LogOut,
  MailWarning,
  Menu,
  MessageSquare,
  Plus,
  User,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getSignedAvatarUrl } from "@/lib/avatar-client";
import { brand } from "@/config/brand";
import { AdaptiveNavPill } from "@/components/ui/3d-adaptive-navigation-bar";
import { isPublicProfilePathname } from "@/lib/routing";
import { toast } from "@/components/system/toaster";
import { getSiteOrigin } from "@/lib/site-url";
import type { DashboardNotificationItem } from "@/lib/dashboard-notifications";

type UserLite = {
  id: string;
  email: string | null;
  fullName?: string | null;
  emailConfirmedAt?: string | null;
} | null;

const LANDING_LINKS = [
  {
    id: "how-it-works",
    label: "How it Works",
    gradient: "linear-gradient(120deg,#ff9776 0%,#ffb166 100%)",
    shadow: "0 10px 24px rgba(255,151,118,0.35)",
  },
  {
    id: "customization",
    label: "Customization",
    gradient: "linear-gradient(120deg,#ffb166 0%,#ffd27f 100%)",
    shadow: "0 10px 24px rgba(255,183,120,0.32)",
  },
  {
    id: "demo",
    label: "Demo",
    gradient: "linear-gradient(120deg,#ffd27f 0%,#ffc3a0 100%)",
    shadow: "0 10px 24px rgba(255,178,140,0.28)",
  },
  {
    id: "pricing",
    label: "Pricing",
    gradient: "linear-gradient(120deg,#ffc3a0 0%,#ff9fb7 100%)",
    shadow: "0 10px 24px rgba(255,159,183,0.28)",
  },
  {
    id: "faq",
    label: "FAQ",
    gradient: "linear-gradient(120deg,#ff9fb7 0%,#7fc8e8 100%)",
    shadow: "0 10px 24px rgba(127,200,232,0.3)",
  },
] as const;

type LandingSectionId = (typeof LANDING_LINKS)[number]["id"];

const DASHBOARD_NAV = [
  { href: "/dashboard/overview", label: "Overview" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/profiles", label: "Public Profile" },
] as const;

const MARKETING_LINKS: Array<{ href: string; label: string }> = [];

const PROFILE_SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "contact", label: "Contact", icon: IdCard },
  { id: "links", label: "Links", icon: Link2 },
  { id: "lead", label: "Lead Form", icon: MessageSquare },
] as const;

const NOTIFICATIONS_POLL_INTERVAL_MS = 45_000;
const DASHBOARD_VERIFICATION_ENTRY = "/dashboard/overview";
const NOTIFICATIONS_LAST_READ_STORAGE_KEY_PREFIX =
  "linket:dashboard-notifications:last-read-at";
const NOTIFICATIONS_OPENED_AT_STORAGE_KEY_PREFIX =
  "linket:dashboard-notifications:opened-at";
const NOTIFICATIONS_INBOX_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

function toUserLite(
  value: {
    id: string;
    email?: string | null;
    user_metadata?: { full_name?: string | null };
    email_confirmed_at?: string | null;
  } | null
): UserLite {
  if (!value) return null;
  return {
    id: value.id,
    email: value.email ?? null,
    fullName: (value.user_metadata?.full_name as string | null) ?? null,
    emailConfirmedAt: value.email_confirmed_at ?? null,
  };
}

const notificationTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserLite>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [currentHash, setCurrentHash] = useState("");
  const [lockedSection, setLockedSection] = useState<string | null>(null);
  const lockTimeout = useRef<number | null>(null);
  const lockedSectionRef = useRef<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const [accountHandle, setAccountHandle] = useState<string | null>(null);
  const [copyLinkLabel, setCopyLinkLabel] = useState("copy link");
  const copyLinkTimeout = useRef<number | null>(null);
  const [dashboardSidebarOpen, setDashboardSidebarOpen] = useState(false);
  const [activeProfileSection, setActiveProfileSection] = useState<
    (typeof PROFILE_SECTIONS)[number]["id"] | null
  >(null);
  const [dashboardNavOffset, setDashboardNavOffset] = useState(0);
  const [verificationBannerDismissed, setVerificationBannerDismissed] =
    useState(false);
  const [verificationStatusRefreshing, setVerificationStatusRefreshing] =
    useState(false);
  const [verificationResending, setVerificationResending] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(
    null
  );
  const [notifications, setNotifications] = useState<DashboardNotificationItem[]>(
    []
  );
  const [notificationsLastReadAt, setNotificationsLastReadAt] = useState<
    number | null
  >(null);
  const [notificationsOpenedAtById, setNotificationsOpenedAtById] = useState<
    Record<string, number>
  >({});
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const siteOrigin = getSiteOrigin();

  useEffect(() => {
    lockedSectionRef.current = lockedSection;
  }, [lockedSection]);

  useEffect(() => {
    return () => {
      if (lockTimeout.current) {
        window.clearTimeout(lockTimeout.current);
      }
      if (copyLinkTimeout.current) {
        window.clearTimeout(copyLinkTimeout.current);
      }
    };
  }, []);
  const isDashboard = pathname?.startsWith("/dashboard");
  const isPublicProfile = isPublicProfilePathname(pathname);
  const isPublic = !isDashboard;
  const isLandingPage = pathname === "/";
  const isAuthPage =
    pathname?.startsWith("/auth") || pathname?.startsWith("/forgot-password");
  const isProfileEditor = pathname?.startsWith("/dashboard/profiles") ?? false;
  const isMarketingPage =
    isPublic && !isLandingPage && !isPublicProfile && !isAuthPage;
  const userNeedsEmailVerification =
    Boolean(user?.email) && !Boolean(user?.emailConfirmedAt);
  const shouldShowNotifications = Boolean(isDashboard && user);
  const notificationsReadStorageKey = user?.id
    ? `${NOTIFICATIONS_LAST_READ_STORAGE_KEY_PREFIX}:${user.id}`
    : null;
  const notificationsOpenedStorageKey = user?.id
    ? `${NOTIFICATIONS_OPENED_AT_STORAGE_KEY_PREFIX}:${user.id}`
    : null;

  useEffect(() => {
    if (!isDashboard) {
      setUser(null);
      setAccountHandle(null);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUser(toUserLite(user ?? null));
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toUserLite(session?.user ?? null));
    });
    unsubscribe = () => sub.subscription.unsubscribe();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [isDashboard]);

  useEffect(() => {
    if (!isDashboard || !user?.id) {
      setAccountHandle(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const response = await fetch(
          `/api/account/handle?userId=${encodeURIComponent(user.id)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { handle?: string | null };
        if (!active) return;
        setAccountHandle(payload.handle ?? null);
      } catch {
        if (active) setAccountHandle(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [isDashboard, user?.id]);

  useEffect(() => {
    if (!isDashboard) return;
    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ handle?: string | null }>).detail;
      if (detail?.handle) {
        setAccountHandle(detail.handle);
      }
    };
    window.addEventListener("linket:handle-updated", handleUpdated);
    return () => {
      window.removeEventListener("linket:handle-updated", handleUpdated);
    };
  }, [isDashboard]);

  useEffect(() => {
    if (!isProfileEditor) {
      setActiveProfileSection(null);
      return;
    }
    const handleSection = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      const next = detail?.section;
      if (!next) return;
      if (PROFILE_SECTIONS.some((section) => section.id === next)) {
        setActiveProfileSection(next as (typeof PROFILE_SECTIONS)[number]["id"]);
      }
    };
    window.addEventListener("linket:profile-section-updated", handleSection);
    return () => {
      window.removeEventListener("linket:profile-section-updated", handleSection);
    };
  }, [isProfileEditor]);

  useEffect(() => {
    if (!isDashboard) {
      setDashboardSidebarOpen(false);
      return;
    }
    const handleSidebarState = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      setDashboardSidebarOpen(Boolean(detail?.open));
    };
    window.addEventListener("linket:dashboard-sidebar-state", handleSidebarState);
    return () => {
      window.removeEventListener("linket:dashboard-sidebar-state", handleSidebarState);
    };
  }, [isDashboard]);

  useEffect(() => {
    if (!isDashboard || !user?.id || user.emailConfirmedAt) {
      setVerificationBannerDismissed(false);
    }
  }, [isDashboard, user?.emailConfirmedAt, user?.id]);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [pathname, user?.id]);

  useEffect(() => {
    if (!shouldShowNotifications || !notificationsReadStorageKey) {
      setNotificationsLastReadAt(null);
      return;
    }

    const rawValue = window.localStorage.getItem(notificationsReadStorageKey);
    if (!rawValue) {
      setNotificationsLastReadAt(null);
      return;
    }
    const parsed = Number(rawValue);
    setNotificationsLastReadAt(Number.isFinite(parsed) ? parsed : null);
  }, [notificationsReadStorageKey, shouldShowNotifications]);

  useEffect(() => {
    if (!shouldShowNotifications || !notificationsOpenedStorageKey) {
      setNotificationsOpenedAtById({});
      return;
    }

    const now = Date.now();
    const rawValue = window.localStorage.getItem(notificationsOpenedStorageKey);
    if (!rawValue) {
      setNotificationsOpenedAtById({});
      return;
    }

    const parsed = safeParseNotificationOpenedAtMap(rawValue);
    const nextEntries = Object.entries(parsed).filter(([, openedAt]) => {
      return now - openedAt <= NOTIFICATIONS_INBOX_RETENTION_MS;
    });
    const nextMap = Object.fromEntries(nextEntries);

    window.localStorage.setItem(
      notificationsOpenedStorageKey,
      JSON.stringify(nextMap)
    );
    setNotificationsOpenedAtById(nextMap);
  }, [notificationsOpenedStorageKey, shouldShowNotifications]);

  useEffect(() => {
    if (!shouldShowNotifications || !user?.id) {
      setNotifications([]);
      setNotificationsLoading(false);
      setNotificationsError(null);
      return;
    }

    let active = true;

    const loadNotifications = async (background = false) => {
      if (!background) {
        setNotificationsLoading(true);
      }
      try {
        const response = await fetch("/api/dashboard/notifications?limit=8", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { notifications?: DashboardNotificationItem[]; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load notifications.");
        }
        if (!active) return;
        setNotifications(
          Array.isArray(payload?.notifications) ? payload.notifications : []
        );
        setNotificationsError(null);
      } catch (error) {
        if (!active) return;
        const description =
          error instanceof Error
            ? error.message
            : "Unable to load notifications.";
        setNotificationsError(description);
      } finally {
        if (!background && active) {
          setNotificationsLoading(false);
        }
      }
    };

    void loadNotifications();
    const poller = window.setInterval(() => {
      void loadNotifications(true);
    }, NOTIFICATIONS_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(poller);
    };
  }, [shouldShowNotifications, user?.id]);

  const markNotificationsAsRead = useCallback(() => {
    if (!notificationsReadStorageKey) return;

    const latestTimestamp = notifications.reduce((max, item) => {
      const timestamp = Date.parse(item.createdAt);
      if (!Number.isFinite(timestamp)) return max;
      return Math.max(max, timestamp);
    }, Date.now());

    setNotificationsLastReadAt((previous) => {
      const next = Math.max(previous ?? 0, latestTimestamp);
      window.localStorage.setItem(notificationsReadStorageKey, String(next));
      return next;
    });
  }, [notifications, notificationsReadStorageKey]);

  const markNotificationsAsOpened = useCallback(() => {
    if (!notificationsOpenedStorageKey || notifications.length === 0) return;

    const now = Date.now();
    setNotificationsOpenedAtById((previous) => {
      const next: Record<string, number> = {};
      let hasChanges = false;

      for (const [id, openedAt] of Object.entries(previous)) {
        if (now - openedAt <= NOTIFICATIONS_INBOX_RETENTION_MS) {
          next[id] = openedAt;
        } else {
          hasChanges = true;
        }
      }

      for (const notification of notifications) {
        if (typeof next[notification.id] === "number") continue;
        next[notification.id] = now;
        hasChanges = true;
      }

      if (hasChanges) {
        window.localStorage.setItem(
          notificationsOpenedStorageKey,
          JSON.stringify(next)
        );
      }

      return hasChanges ? next : previous;
    });
  }, [notifications, notificationsOpenedStorageKey]);

  const notificationsInboxItems = useMemo(() => {
    const now = Date.now();
    return notifications.filter((notification) => {
      const openedAt = notificationsOpenedAtById[notification.id];
      if (!Number.isFinite(openedAt)) return true;
      return now - openedAt <= NOTIFICATIONS_INBOX_RETENTION_MS;
    });
  }, [notifications, notificationsOpenedAtById]);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.reduce((count, notification) => {
      const createdAt = Date.parse(notification.createdAt);
      if (!Number.isFinite(createdAt)) return count;
      if (notificationsLastReadAt === null || createdAt > notificationsLastReadAt) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [notifications, notificationsLastReadAt]);

  const visibleNotificationsBadgeCount = notificationsOpen
    ? 0
    : unreadNotificationsCount;

  const handleNotificationsOpenChange = useCallback(
    (open: boolean) => {
      setNotificationsOpen(open);
      if (open) {
        markNotificationsAsOpened();
        markNotificationsAsRead();
      }
    },
    [markNotificationsAsOpened, markNotificationsAsRead]
  );

  const handleNotificationsToggle = useCallback(() => {
    setNotificationsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        markNotificationsAsOpened();
        markNotificationsAsRead();
      }
      return nextOpen;
    });
  }, [markNotificationsAsOpened, markNotificationsAsRead]);

  const profileUrl = accountHandle ? buildPublicProfileUrl(accountHandle) : null;

  const handleViewProfile = () => {
    if (!profileUrl) return;
    window.open(profileUrl, "_blank", "noreferrer");
  };

  const markProfileLinkCopied = () => {
    setCopyLinkLabel("link copied");
    if (copyLinkTimeout.current) {
      window.clearTimeout(copyLinkTimeout.current);
    }
    copyLinkTimeout.current = window.setTimeout(() => {
      setCopyLinkLabel("copy link");
      copyLinkTimeout.current = null;
    }, 2000);
  };

  const copyProfileLinkToClipboard = async () => {
    if (!profileUrl) return;
    await navigator.clipboard.writeText(profileUrl);
    markProfileLinkCopied();
  };

  const handleCopyProfileLink = async () => {
    if (!profileUrl) return;
    try {
      await copyProfileLinkToClipboard();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to copy link";
      toast({ title: "Copy failed", description: message, variant: "destructive" });
    }
  };

  const handleShareProfileLink = async () => {
    if (!profileUrl) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `${brand.name} public profile`,
          url: profileUrl,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
    try {
      await copyProfileLinkToClipboard();
      toast({
        title: "Link copied",
        description: "Public page link copied to clipboard.",
        variant: "success",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to share link";
      toast({ title: "Share failed", description: message, variant: "destructive" });
    }
  };

  const handleLogout = async () => {
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
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({
        title: "Sign out failed",
        description: message,
        variant: "destructive",
      });
      setLoggingOut(false);
    }
  };

  const refreshEmailVerificationStatus = useCallback(
    async (showFeedback: boolean = true) => {
      if (!isDashboard || !user?.id) return;
      setVerificationStatusRefreshing(true);
      try {
        const {
          data: { user: refreshedUser },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;
        if (!refreshedUser) return;

        const nextUser = toUserLite(refreshedUser);
        setUser(nextUser);

        if (nextUser?.emailConfirmedAt) {
          setVerificationBannerDismissed(false);
          if (showFeedback) {
            toast({
              title: "Email verified",
              description: "Your account is fully verified.",
              variant: "success",
            });
          }
          return;
        }

        if (showFeedback) {
          toast({
            title: "Still waiting on verification",
            description: "Open your inbox and use the verification link first.",
          });
        }
      } catch (error) {
        if (showFeedback) {
          const description =
            error instanceof Error
              ? error.message
              : "Unable to refresh verification status.";
          toast({
            title: "Verification check failed",
            description,
            variant: "destructive",
          });
        }
      } finally {
        setVerificationStatusRefreshing(false);
      }
    },
    [isDashboard, user?.id]
  );

  const handleResendVerificationEmail = useCallback(async () => {
    if (!isDashboard || !user?.email) return;
    setVerificationResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: {
          emailRedirectTo: `${siteOrigin}/auth/callback?next=${encodeURIComponent(
            DASHBOARD_VERIFICATION_ENTRY
          )}`,
        },
      });
      if (error) throw error;
      toast({
        title: "Verification email sent",
        description: "Check your inbox for the verification link.",
        variant: "success",
      });
    } catch (error) {
      const description =
        error instanceof Error
          ? error.message
          : "Unable to resend verification email.";
      toast({
        title: "Couldn't resend email",
        description,
        variant: "destructive",
      });
    } finally {
      setVerificationResending(false);
    }
  }, [isDashboard, siteOrigin, user?.email]);

  useEffect(() => {
    if (!isDashboard || !userNeedsEmailVerification) return;

    const handleFocus = () => {
      void refreshEmailVerificationStatus(false);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshEmailVerificationStatus(false);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isDashboard, refreshEmailVerificationStatus, userNeedsEmailVerification]);

  const handleDashboardMenuToggle = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("linket:dashboard-sidebar-toggle"));
  };

  useEffect(() => {
    if (!isDashboard || !user) {
      setAvatarUrl(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
        const signed = await getSignedAvatarUrl(
          (data?.avatar_url as string | null) ?? null,
          (data?.updated_at as string | null) ?? null
        );
        setAvatarUrl(signed);
    })();
  }, [user, isDashboard]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isLandingPage || typeof window === "undefined") {
      setCurrentHash("");
      return;
    }
    const nextHash = window.location.hash || `#${LANDING_LINKS[0].id}`;
    setCurrentHash(nextHash);
    const handleHash = () =>
      setCurrentHash(window.location.hash || `#${LANDING_LINKS[0].id}`);
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [isLandingPage]);

  useEffect(() => {
    if (!isLandingPage || typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (lockedSectionRef.current) return;
        if (visible?.target?.id) {
          const nextHash = `#${visible.target.id}`;
          setCurrentHash((prev) => (prev === nextHash ? prev : nextHash));
        }
      },
      {
        threshold: [0.3, 0.5, 0.7],
        rootMargin: "-15% 0px -35% 0px",
      }
    );
    LANDING_LINKS.forEach((link) => {
      const section = document.getElementById(link.id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, [isLandingPage]);

  useEffect(() => {
    if (!isPublic) {
      setIsAtTop(true);
      return;
    }
    const handleScroll = () => {
      setIsAtTop(window.scrollY <= 16);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isPublic]);

  useEffect(() => {
    if (!isDashboard || typeof window === "undefined") {
      setDashboardNavOffset(0);
      return;
    }

    const MAX_OFFSET_PX = 18;
    const FULL_OFFSET_SCROLL_PX = 220;
    let rafId: number | null = null;
    let scrollHost: HTMLElement | null = null;

    const readScrollTop = () => {
      if (scrollHost) return scrollHost.scrollTop;
      const host = document.querySelector<HTMLElement>(".dashboard-scroll-area");
      if (host) {
        scrollHost = host;
        return host.scrollTop;
      }
      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const applyOffset = () => {
      rafId = null;
      const scrollTop = readScrollTop();
      const ratio = Math.min(1, Math.max(0, scrollTop / FULL_OFFSET_SCROLL_PX));
      const next = Math.round(ratio * MAX_OFFSET_PX);
      setDashboardNavOffset((prev) => (prev === next ? prev : next));
    };

    const requestApplyOffset = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(applyOffset);
    };

    const connectScrollHost = () => {
      const nextHost = document.querySelector<HTMLElement>(".dashboard-scroll-area");
      if (nextHost === scrollHost) return;
      if (scrollHost) {
        scrollHost.removeEventListener("scroll", requestApplyOffset);
      }
      scrollHost = nextHost;
      if (scrollHost) {
        scrollHost.addEventListener("scroll", requestApplyOffset, {
          passive: true,
        });
      }
    };

    connectScrollHost();
    requestApplyOffset();
    window.addEventListener("scroll", requestApplyOffset, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", requestApplyOffset, { passive: true });
    const reconnectTimer = window.setInterval(connectScrollHost, 500);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (scrollHost) {
        scrollHost.removeEventListener("scroll", requestApplyOffset);
      }
      window.removeEventListener("scroll", requestApplyOffset, true);
      window.removeEventListener("resize", requestApplyOffset);
      window.clearInterval(reconnectTimer);
    };
  }, [isDashboard]);

  if (isPublicProfile) {
    return null;
  }

  const overlayMode = isPublic && isAtTop && isLandingPage;

  const headerClassName = cn(
    "top-0 z-50 w-full border-b transition-all duration-300",
    isDashboard
      ? "sticky border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      : "fixed border-white/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60",
    overlayMode &&
      "border-transparent bg-transparent text-white backdrop-blur-none supports-[backdrop-filter]:bg-transparent"
  );

  const brandNameClass = cn(
    "text-xl font-semibold tracking-tight transition-colors",
    isDashboard
      ? "text-foreground"
      : overlayMode
      ? "text-white drop-shadow"
      : "text-[#0f172a]"
  );

  const activeLandingSection = isLandingPage
    ? currentHash
      ? currentHash.replace("#", "")
      : LANDING_LINKS[0].id
    : null;

  const scrollToSection = (sectionId: LandingSectionId) => {
    if (typeof window === "undefined") return;
    const element = document.getElementById(sectionId);
    if (!element) return;
    const headerOffset = 80;
    const offsetPosition =
      element.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({
      top: Math.max(offsetPosition, 0),
      behavior: "smooth",
    });
    if (lockTimeout.current) {
      window.clearTimeout(lockTimeout.current);
    }
    setLockedSection(sectionId);
    lockTimeout.current = window.setTimeout(() => {
      setLockedSection(null);
      lockTimeout.current = null;
    }, 900);
    const hash = `#${sectionId}`;
    setCurrentHash(hash);
    window.history.replaceState(null, "", hash);
  };

  const handlePillSelect = (sectionId: string) => {
    const validSectionId = sectionId as LandingSectionId;
    if (isLandingPage) {
      scrollToSection(validSectionId);
    } else {
      router.push(`/#${validSectionId}`);
    }
  };

  const handleDropdownSelect = (sectionId: LandingSectionId) => {
    handlePillSelect(sectionId);
    setMobileOpen(false);
  };

  const mobilePanelClass = cn(
    "fixed inset-x-3 top-[5.25rem] z-50 rounded-2xl border p-4 shadow-xl backdrop-blur-sm sm:inset-x-4 sm:top-24 sm:p-6",
    isDashboard
      ? "border-border/60 bg-background/95"
      : overlayMode
      ? "border-white/30 bg-slate-900/85 text-white"
      : "border-foreground/10 bg-white"
  );

  const mobileAvatarFrame = cn(
    "inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border bg-white",
    isDashboard
      ? "border-border/60 bg-card"
      : overlayMode
      ? "border-white/40 bg-white/10"
      : ""
  );

  const desktopLinks = (
    <div className="w-full max-w-[720px] px-4">
      <AdaptiveNavPill
        items={LANDING_LINKS}
        activeId={activeLandingSection}
        onSelect={handlePillSelect}
      />
    </div>
  );

  const marketingNav = MARKETING_LINKS.length ? (
    <div className="flex w-full items-center justify-center gap-6 px-4">
      {MARKETING_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "text-sm font-semibold transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  ) : null;

  const loginButton = user ? (
    <Link
      href="/dashboard/linkets"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-semibold uppercase tracking-[0.08em] transition md:h-12 md:px-5 md:text-sm",
        isDashboard
          ? "bg-foreground text-background hover:bg-foreground/90"
          : overlayMode
          ? "border border-white/40 bg-white/5 text-white shadow-[0_16px_32px_rgba(15,23,42,0.25)] hover:bg-white/15"
          : "bg-[#0b1220] text-white shadow-[0_18px_32px_rgba(15,23,42,0.25)] hover:bg-[#141c32]"
      )}
      aria-label={`Go to ${brand.name} dashboard`}
    >
      Dashboard
    </Link>
  ) : (
    <Button
      asChild
      className={cn(
        "h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.08em] md:h-12 md:px-6 md:text-sm",
        isDashboard
          ? "border border-foreground/20 bg-background text-foreground hover:bg-foreground/5"
          : overlayMode
          ? "bg-white text-slate-900 shadow-[0_18px_35px_rgba(15,23,42,0.25)] hover:bg-white/90"
          : "bg-white text-[#0b1220] shadow-[0_12px_30px_rgba(15,23,42,0.12)] hover:bg-white/95"
      )}
      aria-label="Sign in"
    >
      <Link href="/auth?view=signin">Sign in</Link>
    </Button>
  );

  const primaryCta = (
    <Button
      asChild
      className={cn(
        "h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.08em] md:h-12 md:px-6 md:text-sm",
        isDashboard
          ? "shadow-[0_12px_40px_rgba(16,200,120,0.15)] hover:shadow-[0_18px_45px_rgba(16,200,120,0.22)]"
          : overlayMode
          ? "bg-white text-slate-900 shadow-[0_22px_50px_rgba(15,23,42,0.35)] hover:bg-white/90"
          : "bg-gradient-to-r from-[#7fc8e8] via-[#5fb7f5] to-[#a5f3fc] text-[#0b1220] shadow-[0_20px_45px_rgba(125,200,232,0.35)] hover:bg-gradient-to-r hover:from-[#ff9776] hover:via-[#ffb166] hover:to-[#ffd27f]"
      )}
    >
      <Link href="/#pricing" aria-label="Buy Linket">
        Buy Linket
      </Link>
    </Button>
  );

  const navClassName = cn(
    "mx-auto flex max-w-6xl items-center justify-between px-3 py-2 md:px-6 md:py-3",
    overlayMode ? "text-white" : "text-foreground"
  );

  const activeLandingId = (activeLandingSection ??
    LANDING_LINKS[0].id) as LandingSectionId;

  const dashboardAvatar = user ? (
    <button
      type="button"
      ref={accountButtonRef}
      onClick={() => setAccountMenuOpen(true)}
      className="dashboard-avatar-button inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card/90 text-sm font-semibold uppercase text-foreground transition hover:bg-card"
      aria-label="Account menu"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="avatar"
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        getUserInitials(user.fullName ?? user.email ?? "PK")
      )}
    </button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      asChild
      className="rounded-full border-border/60 bg-card/80 text-foreground hover:bg-card"
    >
      <Link href="/auth?view=signin">Sign in</Link>
    </Button>
  );

  const dashboardProfileActions = user ? (
    <div className="dashboard-nav-actions hidden items-center gap-2 md:flex">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="dashboard-copy-link-button rounded-full cursor-pointer disabled:cursor-not-allowed"
        onClick={handleCopyProfileLink}
        disabled={!profileUrl}
      >
        {copyLinkLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="dashboard-view-profile-button rounded-full cursor-pointer disabled:cursor-not-allowed"
        onClick={handleViewProfile}
        disabled={!profileUrl}
        aria-label="Open public profile"
        title="Open public profile"
      >
        <span className="dashboard-view-profile-icon" aria-hidden="true">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </Button>
    </div>
  ) : null;

  const dashboardNotificationsButton =
    user && shouldShowNotifications ? (
      <button
        type="button"
        ref={notificationsButtonRef}
        onClick={handleNotificationsToggle}
        className="dashboard-notifications-button relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/80 text-foreground transition hover:bg-card"
        aria-label="Open notifications"
        aria-expanded={notificationsOpen}
        aria-haspopup="dialog"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {visibleNotificationsBadgeCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {Math.min(9, visibleNotificationsBadgeCount)}
          </span>
        ) : null}
      </button>
    ) : null;

  if (isDashboard) {
    const overviewHref = "/dashboard/overview";
    const activeDashboardHref = (() => {
      if (!pathname) return null;
      if (!pathname.startsWith("/dashboard")) return null;
      if (pathname === "/dashboard" || pathname === overviewHref)
        return overviewHref;
      let match: string | null = null;
      for (const item of DASHBOARD_NAV) {
        if (item.href === overviewHref) continue;
        if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
          if (!match || item.href.length > match.length) {
            match = item.href;
          }
        }
      }
      return match;
    })();

    const isNavActive = (href: string) => activeDashboardHref === href;

    const dashboardLink = (link: (typeof DASHBOARD_NAV)[number]) => {
      const isActive = isNavActive(link.href);
      return (
        <Link
          key={link.href}
          href={link.href}
          data-active={isActive ? "true" : "false"}
          className={cn(
            "dashboard-nav-link rounded-full px-4 py-2 text-sm font-semibold tracking-wide transition lg:inline-flex",
            isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {link.label}
        </Link>
      );
    };

    return (
      <header
        className="dashboard-navbar font-dashboard sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/70"
        style={{ top: `${dashboardNavOffset}px` }}
      >
        {userNeedsEmailVerification && !verificationBannerDismissed ? (
          <div className="border-b border-amber-200/70 bg-amber-100/70 px-3 py-2">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <MailWarning className="h-4 w-4" aria-hidden />
                <span>
                  Verify your email address through your inbox to secure your
                  account.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-amber-300 bg-amber-50 text-xs text-amber-900 hover:bg-amber-100"
                  onClick={() => void refreshEmailVerificationStatus(true)}
                  disabled={verificationStatusRefreshing}
                >
                  {verificationStatusRefreshing ? "Checking..." : "I've verified"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-full bg-amber-900 text-xs text-amber-50 hover:bg-amber-950"
                  onClick={() => void handleResendVerificationEmail()}
                  disabled={verificationResending}
                >
                  {verificationResending ? "Sending..." : "Resend email"}
                </Button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-amber-900 hover:bg-amber-200/70"
                  aria-label="Dismiss email verification reminder"
                  onClick={() => setVerificationBannerDismissed(true)}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <nav
          className="dashboard-navbar-inner mx-auto flex max-w-6xl items-center justify-between px-2 py-3 text-foreground sm:px-3 md:px-6"
          aria-label="Dashboard"
        >
          <div className="dashboard-navbar-left flex min-w-0 flex-1 items-center gap-4 pr-3">
            <Link
              href="/dashboard"
              className="dashboard-brand ml-0 inline-flex items-center gap-3 md:-ml-8 lg:-ml-10"
              aria-label={`${brand.name} dashboard`}
            >
              {brand.logo ? (
                <span className="dashboard-logo relative h-14 w-44 overflow-hidden">
                  <Image
                    src={brand.logo}
                    alt={`${brand.name} logo`}
                    fill
                    className="object-contain"
                    sizes="128px"
                    priority
                  />
                </span>
              ) : (
                <span className="dashboard-logo-fallback inline-flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold">
                  {(brand.shortName ?? brand.name).slice(0, 2)}
                </span>
              )}
            </Link>
            {isProfileEditor ? (
              <>
                <div className="hidden min-w-0 max-w-[550px] flex-1 md:ml-3 md:flex lg:ml-5">
                  <div className="flex min-h-[52px] w-full items-center rounded-2xl border border-border/50 bg-card/70 px-3 py-2 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.45)]">
                    <div className="flex w-full flex-nowrap items-center gap-2">
                      {PROFILE_SECTIONS.map((section) => {
                        const Icon = section.icon;
                        const isActive = activeProfileSection === section.id;
                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent("linket:profile-section-nav", {
                                  detail: { section: section.id },
                                })
                              );
                            }}
                            className={cn(
                              "dashboard-profile-section-pill flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition cursor-pointer",
                              isActive
                                ? "bg-muted text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                                : "text-muted-foreground"
                            )}
                          >
                            <Icon
                              className={cn(
                                "shrink-0",
                                section.id === "contact" ? "h-7 w-7" : "h-5 w-5"
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0 truncate whitespace-nowrap">
                              {section.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div className="dashboard-navbar-right flex shrink-0 items-center gap-3">
            {dashboardProfileActions}
            {dashboardNotificationsButton}
            {user ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="dashboard-view-profile-button dashboard-share-link-button rounded-full cursor-pointer disabled:cursor-not-allowed md:hidden"
                onClick={handleShareProfileLink}
                disabled={!profileUrl}
                aria-label="Share public profile link"
                title="Share public profile link"
              >
                <span className="dashboard-view-profile-icon" aria-hidden="true">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </Button>
            ) : null}
            <Button
              asChild
              size="sm"
              className="dashboard-new-linket-button hidden rounded-full lg:inline-flex"
            >
              <Link href="/dashboard/linkets">New Linket</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="dashboard-new-linket-button dashboard-new-linket-button--mobile rounded-full lg:hidden"
            >
              <Link
                href="/dashboard/linkets"
                aria-label="Create new Linket"
                className="inline-flex items-center gap-1.5"
              >
                <Plus
                  className="dashboard-new-linket-icon h-4 w-4"
                  aria-hidden="true"
                />
                <span className="dashboard-new-linket-label">New Linket</span>
              </Link>
            </Button>
            {dashboardAvatar}
            <button
              type="button"
              className="dashboard-mobile-toggle inline-flex items-center justify-center rounded-full border border-border/60 p-2 text-foreground lg:hidden"
              onClick={handleDashboardMenuToggle}
              aria-label={
                dashboardSidebarOpen ? "Close navigation" : "Open navigation"
              }
              aria-expanded={dashboardSidebarOpen}
            >
              {dashboardSidebarOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </nav>
        {user && (
          <PopoverDialog
            open={accountMenuOpen}
            onOpenChange={setAccountMenuOpen}
            anchorRef={accountButtonRef}
            align="end"
            title="Account menu"
          >
            <div className="dashboard-account-menu-content space-y-2 text-sm">
              <div className="dashboard-account-menu-email rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-xs text-muted-foreground">
                {user?.email ?? "Not signed in"}
              </div>
              <MenuLink href="/dashboard/settings">Account settings</MenuLink>
              <MenuLink href="/dashboard/billing">Billing</MenuLink>
              <MenuButton
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("open-support"))
                }
              >
                Support
              </MenuButton>
              <MenuButton onClick={handleLogout} disabled={loggingOut}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </MenuButton>
            </div>
          </PopoverDialog>
        )}
        {dashboardNotificationsButton && (
          <PopoverDialog
            open={notificationsOpen}
            onOpenChange={handleNotificationsOpenChange}
            anchorRef={notificationsButtonRef}
            align="end"
            title="Notifications"
          >
            <div className="space-y-3">
              {notificationsLoading ? (
                <p className="text-sm text-muted-foreground">Loading notifications...</p>
              ) : notificationsError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {notificationsError}
                </p>
              ) : notificationsInboxItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No developer notifications right now.
                </p>
              ) : (
                notificationsInboxItems.map((notification) => (
                  <article
                    key={notification.id}
                    className={cn(
                      "rounded-xl border px-3 py-2",
                      getNotificationToneClass(notification.severity)
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{notification.title}</p>
                      <span className="text-[11px] font-medium opacity-80">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">
                      {notification.message}
                    </p>
                  </article>
                ))
              )}
            </div>
          </PopoverDialog>
        )}
      </header>
    );
  }

  if (isAuthPage) {
    return (
      <header role="banner" className={headerClassName} aria-label="Site header">
        <nav className={navClassName} aria-label="Main">
          <div className="flex flex-1 items-center gap-3 md:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
              aria-label={`${brand.name} home`}
            >
              {brand.logo ? (
                <span className="relative block h-[3.5rem] w-28 sm:h-[3.75rem] sm:w-32 md:h-[4.5rem] md:w-40">
                  <Image
                    src={brand.logo}
                    alt={`${brand.name} logo`}
                    fill
                    className="object-contain"
                    priority
                    sizes="(max-width: 1024px) 160px, 200px"
                  />
                </span>
              ) : (
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background"
                  aria-hidden
                >
                  {(brand.shortName ?? brand.name).slice(0, 2)}
                </span>
              )}
              {!brand.logo && (
                <span className={brandNameClass}>{brand.name}</span>
              )}
            </Link>
          </div>
        </nav>
      </header>
    );
  }

  return (
    <header role="banner" className={headerClassName} aria-label="Site header">
      <nav className={navClassName} aria-label="Main">
        <div className="flex flex-1 items-center gap-3 md:gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            aria-label={`${brand.name} home`}
          >
            {brand.logo ? (
                <span className="relative block h-[3.5rem] w-28 sm:h-[3.75rem] sm:w-32 md:h-[4.5rem] md:w-40">
                  <Image
                    src={brand.logo}
                    alt={`${brand.name} logo`}
                  fill
                  className="object-contain"
                  priority
                  sizes="(max-width: 1024px) 160px, 200px"
                />
              </span>
            ) : (
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background"
                aria-hidden
              >
                {(brand.shortName ?? brand.name).slice(0, 2)}
              </span>
            )}
            {!brand.logo && (
              <span className={brandNameClass}>{brand.name}</span>
            )}
          </Link>
        <div
          className="hidden flex-1 items-center justify-center lg:flex"
          aria-label="Primary"
        >
          {isLandingPage ? desktopLinks : null}
          {isMarketingPage ? marketingNav : null}
        </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          {isLandingPage || isMarketingPage ? (
            <div className="hidden items-center gap-2 sm:flex md:gap-4">
              {loginButton}
              {primaryCta}
            </div>
          ) : null}
          {isLandingPage || isMarketingPage ? (
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-full border p-2 transition lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                isDashboard
                  ? "border-border/60 bg-background/70 text-foreground"
                  : overlayMode
                  ? "border-white/70 bg-white/90 text-slate-900 shadow-[0_10px_25px_rgba(15,15,30,0.2)]"
                  : "border-foreground/10 bg-white/80 text-foreground"
              )}
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
      </nav>
      {(isLandingPage || isMarketingPage) && mobileOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            aria-label="Close navigation overlay"
            onClick={() => setMobileOpen(false)}
          />
          <div className={mobilePanelClass}>
            <nav aria-label="Mobile primary" className="grid gap-4">
              {isLandingPage ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {LANDING_LINKS.map((link) => {
                    const isActive = activeLandingId === link.id;
                    return (
                      <button
                        key={link.id}
                        type="button"
                        onClick={() => handleDropdownSelect(link.id)}
                        className={cn(
                          "min-h-11 rounded-2xl border px-3 py-2 text-center text-xs font-semibold tracking-[0.04em] transition sm:text-sm",
                          isActive
                            ? "border-[#ffb166]/70 bg-[#fff2e6] text-[#9a3412]"
                            : overlayMode
                            ? "border-white/25 bg-white/5 text-white hover:bg-white/12"
                            : "border-foreground/10 bg-white text-[#0b1220] hover:bg-slate-50"
                        )}
                        aria-label={`Go to ${link.label}`}
                      >
                        {link.label}
                      </button>
                    );
                  })}
                </div>
              ) : MARKETING_LINKS.length ? (
                <div className="grid gap-2">
                  {MARKETING_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-2xl border border-foreground/10 bg-white px-4 py-3 text-sm font-semibold text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-3">
                <div className="w-full">{primaryCta}</div>
                <div className="w-full">
                  {user ? (
                    <Link
                      href="/dashboard/linkets"
                      className="flex h-10 items-center justify-center gap-3 rounded-full bg-muted px-4 text-sm font-semibold text-foreground transition hover:bg-muted/80 md:h-12"
                    >
                      {avatarUrl ? (
                        <span className={mobileAvatarFrame} aria-hidden="true">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={avatarUrl}
                            alt="avatar"
                            className="h-full w-full object-cover"
                          />
                        </span>
                      ) : null}
                      Dashboard
                    </Link>
                  ) : (
                    loginButton
                  )}
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

function safeParseNotificationOpenedAtMap(value: string): Record<string, number> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([, timestamp]) => Number.isFinite(timestamp)
    ) as Array<[string, number]>;
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function PopoverDialog({
  open,
  onOpenChange,
  anchorRef,
  align = "start",
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: "start" | "end";
  title?: string;
  children: React.ReactNode;
}) {
  const position = usePopoverPosition(anchorRef, open, align);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="dashboard-account-menu-popover w-72 translate-x-0 translate-y-0 rounded-2xl border border-border/60 bg-background p-4 shadow-lg"
        style={position}
      >
        {title ? (
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
          </DialogHeader>
        ) : null}
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
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="dashboard-account-menu-item flex w-full items-center rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-accent disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="dashboard-account-menu-item flex w-full items-center rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-accent"
    >
      {children}
    </a>
  );
}

function usePopoverPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  align: "start" | "end"
) {
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const padding = 12;
      const maxWidth = Math.min(288, window.innerWidth - padding * 2);
      const desiredLeft = align === "end" ? rect.right - maxWidth : rect.left;
      const left = Math.min(Math.max(padding, desiredLeft), window.innerWidth - maxWidth - padding);
      const top = Math.min(rect.bottom + 8, window.innerHeight - padding);
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
  }, [anchorRef, open, align]);

  return style;
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return notificationTimeFormatter.format(date);
}

function getNotificationToneClass(
  severity: DashboardNotificationItem["severity"]
) {
  switch (severity) {
    case "success":
      return "border-emerald-300 bg-emerald-100/70 text-emerald-950";
    case "warning":
      return "border-amber-300 bg-amber-100/70 text-amber-950";
    case "critical":
      return "border-rose-300 bg-rose-100/70 text-rose-950";
    case "info":
    default:
      return "border-sky-300 bg-sky-100/70 text-sky-950";
  }
}

function buildPublicProfileUrl(handle: string) {
  const base = getSiteOrigin();
  return `${base.replace(/\/$/, "")}/${encodeURIComponent(handle)}`;
}

function getUserInitials(seed: string) {
  const [first, second] = String(seed).split(" ");
  const initialOne = first?.[0] ?? "P";
  const initialTwo = second?.[0] ?? "K";
  return `${initialOne}${initialTwo}`.toUpperCase();
}

export default Navbar;
