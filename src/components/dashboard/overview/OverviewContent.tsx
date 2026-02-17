"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Circle,
  MessageSquare,
  Sparkles,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import { ANALYTICS_BROADCAST_KEY, ANALYTICS_EVENT_NAME } from "@/lib/analytics";
import type { UserAnalytics } from "@/lib/analytics-service";

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});
const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type ViewState = {
  loading: boolean;
  error: string | null;
  analytics: UserAnalytics | null;
};

export default function OverviewContent() {
  const dashboardUser = useDashboardUser();
  const userId = dashboardUser?.id ?? null;
  const [reloadToken, setReloadToken] = useState(0);
  const [isChecklistDismissed, setIsChecklistDismissed] = useState(false);
  const [isChecklistPoppingOut, setIsChecklistPoppingOut] = useState(false);
  const checklistCompletionRef = useRef<boolean | null>(null);
  const checklistDismissTimerRef = useRef<number | null>(null);
  const [{ loading, error, analytics }, setState] = useState<ViewState>({
    loading: true,
    error: null,
    analytics: null,
  });

  useEffect(() => {
    if (userId === null) {
      setState({
        loading: false,
        error: "You're not signed in.",
        analytics: null,
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const resolvedUserId = userId as string;

    async function load() {
      try {
        const timezoneOffsetMinutes = new Date().getTimezoneOffset();
        const analyticsUrl = `/api/analytics/supabase?userId=${encodeURIComponent(
          resolvedUserId
        )}&days=90&tzOffsetMinutes=${encodeURIComponent(
          String(timezoneOffsetMinutes)
        )}`;
        const [analyticsRes] = await Promise.all([
          fetch(analyticsUrl, { cache: "no-store" }),
        ]);

        if (!analyticsRes.ok) {
          const info = await analyticsRes.json().catch(() => ({}));
          throw new Error(
            info?.error || `Analytics request failed (${analyticsRes.status})`
          );
        }

        const analyticsPayload = (await analyticsRes.json()) as UserAnalytics;

        if (!cancelled) {
          setState({
            loading: false,
            error: analyticsPayload.meta.available
              ? null
              : "Analytics requires a configured Supabase service role key.",
            analytics: analyticsPayload,
          });
        }

        if (cancelled) return;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to load overview";
        if (!cancelled) {
          setState({ loading: false, error: message, analytics: null });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    let settleTimer: number | null = null;

    const requestRefresh = () => {
      setReloadToken((value) => value + 1);
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
      // Follow-up refresh catches writes that land slightly after the first request.
      settleTimer = window.setTimeout(() => {
        setReloadToken((value) => value + 1);
      }, 1200);
    };

    const handleAnalyticsEvent = (_event: Event) => {
      requestRefresh();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ANALYTICS_BROADCAST_KEY || !event.newValue) return;
      requestRefresh();
    };

    window.addEventListener(ANALYTICS_EVENT_NAME, handleAnalyticsEvent);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(ANALYTICS_EVENT_NAME, handleAnalyticsEvent);
      window.removeEventListener("storage", handleStorage);
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
    };
  }, [userId]);

  const totals = analytics?.totals;
  const onboarding = analytics?.onboarding;
  const checklistComplete = Boolean(
    onboarding &&
      onboarding.totalCount > 0 &&
      onboarding.completedCount >= onboarding.totalCount
  );
  const leads = analytics?.recentLeads ?? [];
  const recentLeads = leads.slice(0, 5);
  const recentLeadsLoading = loading && !analytics;
  const recentLeadsError = error && !analytics ? error : null;

  const overviewItems = [
    {
      label: "Taps in the past week",
      value: totals ? numberFormatter.format(totals.scans7d) : "--",
      icon: Sparkles,
    },
    {
      label: "Recent leads",
      value: totals ? numberFormatter.format(totals.leads7d) : "--",
      icon: Users,
    },
    {
      label: "Conversion rate (Leads / Taps)",
      value: totals
        ? percentFormatter.format(totals.conversionRate7d || 0)
        : "--",
      icon: BarChart3,
    },
    {
      label: "Leads you should reach out to",
      value: totals ? numberFormatter.format(leads.length) : "--",
      icon: MessageSquare,
    },
  ];

  const [dateLabel, setDateLabel] = useState<string>("");

  useEffect(() => {
    setDateLabel(dateTimeFormatter.format(new Date()));
  }, []);

  useEffect(() => {
    return () => {
      if (checklistDismissTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(checklistDismissTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (loading || !onboarding) return;

    const previousCompletion = checklistCompletionRef.current;

    if (!checklistComplete) {
      if (checklistDismissTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(checklistDismissTimerRef.current);
        checklistDismissTimerRef.current = null;
      }
      setIsChecklistDismissed(false);
      setIsChecklistPoppingOut(false);
    } else if (previousCompletion === false) {
      setIsChecklistPoppingOut(true);
      if (checklistDismissTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(checklistDismissTimerRef.current);
      }
      checklistDismissTimerRef.current = window.setTimeout(() => {
        setIsChecklistDismissed(true);
        setIsChecklistPoppingOut(false);
        checklistDismissTimerRef.current = null;
      }, 420);
    } else if (previousCompletion === null) {
      // Hide immediately when everything was already complete before this session.
      setIsChecklistDismissed(true);
      setIsChecklistPoppingOut(false);
    }

    checklistCompletionRef.current = checklistComplete;
  }, [checklistComplete, loading, onboarding]);


  return (
    <div className="dashboard-overview-page space-y-6">
      <header className="dashboard-overview-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="dashboard-overview-intro space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of taps, leads, analytics, and your public profile.
          </p>
        </div>
        <div className="dashboard-date-pill inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
          {dateLabel}
        </div>
      </header>

      {error && !loading && !analytics ? (
        <Card className="rounded-3xl border border-destructive/40 bg-destructive/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-destructive">
              Analytics unavailable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="dashboard-overview-grid grid gap-6 lg:grid-cols-12">
        <div className="dashboard-overview-column space-y-6 lg:col-span-7">
          <Card className="dashboard-overview-card dashboard-overview-section-card rounded-3xl border border-border/70 bg-card/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg font-semibold text-foreground">
                Overview
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Your latest Linket performance snapshot.
              </p>
            </CardHeader>
            <CardContent className="dashboard-overview-metrics grid grid-cols-1 gap-4 sm:grid-cols-2">
              {overviewItems.map((item) => (
                <MetricRow
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                  loading={loading && !analytics}
                />
              ))}
            </CardContent>
          </Card>

          {isChecklistDismissed ? null : (
            <Card
              className={`dashboard-overview-section-card dashboard-overview-checklist-card rounded-3xl border border-border/70 bg-card/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ${isChecklistPoppingOut ? "dashboard-overview-checklist-card--exiting" : ""}`}
              data-tour="overview-checklist"
            >
              <CardHeader className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <CardTitle className="text-lg font-semibold text-foreground">
                    First-run checklist
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full rounded-full sm:w-auto"
                    onClick={() => {
                      if (typeof window === "undefined") return;
                      window.dispatchEvent(new CustomEvent("linket:onboarding-tour:start"));
                    }}
                  >
                    Start walkthrough
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Complete these steps to launch your profile and start capturing leads.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading && !analytics ? (
                  <div className="space-y-2">
                    <div className="dashboard-skeleton h-2 w-full animate-pulse rounded bg-muted" data-skeleton />
                    <div className="dashboard-skeleton h-10 w-full animate-pulse rounded-2xl bg-muted" data-skeleton />
                    <div className="dashboard-skeleton h-10 w-full animate-pulse rounded-2xl bg-muted" data-skeleton />
                    <div className="dashboard-skeleton h-10 w-full animate-pulse rounded-2xl bg-muted" data-skeleton />
                  </div>
                ) : onboarding ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Progress
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {onboarding.completedCount}/{onboarding.totalCount}
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.round(onboarding.progress * 100)}%` }}
                      />
                    </div>
                    <div className="space-y-2">
                      {onboarding.items.map((item) => (
                        <ChecklistItemRow
                          key={item.id}
                          label={item.label}
                          detail={item.detail}
                          completed={item.completed}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState message="Checklist unavailable right now." />
                )}
              </CardContent>
            </Card>
          )}

          <Card className="dashboard-overview-section-card rounded-3xl border border-border/70 bg-card/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Leads
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Recent prospects captured from Linket scans.
                  </p>
                </div>
              </div>
              <Button
                asChild
                variant="ghost"
                className="text-sm text-primary hover:text-primary/80"
              >
                <Link href="/dashboard/leads">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentLeadsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`lead-skeleton-${index}`}
                      className="dashboard-skeleton h-10 animate-pulse rounded-2xl bg-muted"
                      data-skeleton
                    />
                  ))}
                </div>
              ) : recentLeadsError ? (
                <EmptyState message={recentLeadsError} />
              ) : recentLeads.length > 0 ? (
                <div className="space-y-3">
                  {recentLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {lead.name?.trim() || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {lead.email ?? "No email"}
                            {lead.company ? ` - ${lead.company}` : ""}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {timestampFormatter.format(
                            new Date(lead.created_at)
                          )}
                        </div>
                      </div>
                      {lead.message ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {lead.message}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No leads yet. Share your public page to collect contacts." />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="hidden md:block lg:col-span-5">
          <Card className="h-full rounded-[44px] border border-border/70 bg-card/90 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <CardContent className="flex h-full items-stretch px-6 py-2">
              <PublicProfilePreviewPanel userId={userId ?? null} />
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

function MetricRow({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="dashboard-metric-row flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="dashboard-metric-icon inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="dashboard-metric-label text-sm font-medium text-foreground">{label}</span>
      </div>
      <span className="dashboard-metric-value text-sm font-semibold text-foreground">
        {loading ? <span className="text-muted-foreground">--</span> : value}
      </span>
    </div>
  );
}

function ChecklistItemRow({
  label,
  detail,
  completed,
}: {
  label: string;
  detail: string;
  completed: boolean;
}) {
  return (
    <div className="dashboard-overview-checklist-item flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-primary" aria-hidden>
          {completed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
        <div>
          <p className="dashboard-overview-checklist-label text-sm font-medium text-foreground">{label}</p>
          <p className="dashboard-overview-checklist-detail text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <span className="dashboard-overview-checklist-status text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {completed ? "Done" : "Pending"}
      </span>
    </div>
  );
}

function PublicProfilePreviewPanel({ userId }: { userId: string | null }) {
  const hasHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publicHandle, setPublicHandle] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [frameVersion, setFrameVersion] = useState(0);
  const reloadTimerRef = useRef<number | null>(null);

  const reloadFrame = useCallback((withSettle = false) => {
    setFrameReady(false);
    setFrameVersion((value) => value + 1);
    if (typeof window === "undefined") return;
    if (reloadTimerRef.current !== null) {
      window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }
    if (!withSettle) return;
    // Theme saves are async; follow-up refresh picks up the committed theme.
    reloadTimerRef.current = window.setTimeout(() => {
      setFrameReady(false);
      setFrameVersion((value) => value + 1);
      reloadTimerRef.current = null;
    }, 1800);
  }, []);

  const fetchPublicHandle = useCallback(async () => {
    if (!userId) {
      throw new Error("Sign in to see your live preview.");
    }
    const accountRes = await fetch(
      `/api/account/handle?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    if (!accountRes.ok) {
      const info = await accountRes.json().catch(() => ({}));
      throw new Error(info?.error || "Unable to load account.");
    }
    const accountPayload = (await accountRes.json()) as {
      handle?: string | null;
    };
    const resolvedHandle = accountPayload.handle?.trim().toLowerCase();
    if (!resolvedHandle) {
      throw new Error("Create a public profile to see the preview.");
    }
    return resolvedHandle;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    (async () => {
      if (!active) return;
      setLoading(true);
      setError(null);
      setPublicHandle(null);
      setFrameReady(false);
      try {
        const resolvedHandle = await fetchPublicHandle();
        if (!active) return;
        setPublicHandle(resolvedHandle);
        setFrameReady(false);
        setLoading(false);
        reloadFrame(false);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Preview unavailable.");
        setPublicHandle(null);
        setFrameReady(false);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [fetchPublicHandle, reloadFrame, userId]);

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(reloadTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const refreshFromServer = async () => {
      try {
        const nextHandle = await fetchPublicHandle();
        setPublicHandle((prev) => (prev === nextHandle ? prev : nextHandle));
        setError(null);
        reloadFrame(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview unavailable.");
      }
    };

    const handleThemeChange = () => {
      if (!publicHandle) return;
      reloadFrame(true);
    };

    const handleProfilesUpdated = () => {
      void refreshFromServer();
    };

    const handleHandleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ handle?: string }>).detail;
      const nextHandle = detail?.handle?.trim().toLowerCase();
      if (nextHandle) {
        setPublicHandle(nextHandle);
        setError(null);
        reloadFrame(true);
        return;
      }
      void refreshFromServer();
    };

    window.addEventListener("linket:theme-change", handleThemeChange);
    window.addEventListener("linket-profiles:updated", handleProfilesUpdated);
    window.addEventListener("linket:handle-updated", handleHandleUpdated);

    return () => {
      window.removeEventListener("linket:theme-change", handleThemeChange);
      window.removeEventListener("linket-profiles:updated", handleProfilesUpdated);
      window.removeEventListener("linket:handle-updated", handleHandleUpdated);
    };
  }, [fetchPublicHandle, publicHandle, reloadFrame, userId]);

  if (!hasHydrated) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[36px] border border-border/60 bg-background px-4 text-center text-sm text-muted-foreground shadow-[0_20px_40px_-30px_rgba(15,23,42,0.3)]">
        Loading preview...
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[36px] border border-border/60 bg-background px-4 text-center text-sm text-muted-foreground shadow-[0_20px_40px_-30px_rgba(15,23,42,0.3)]">
        Sign in to see your live preview.
      </div>
    );
  }

  const previewSrc = publicHandle
    ? `/${encodeURIComponent(publicHandle)}?overviewPreview=${frameVersion}`
    : null;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative h-full w-full max-w-sm overflow-hidden rounded-[36px] border border-border/60 bg-black shadow-[0_24px_48px_-32px_rgba(15,23,42,0.45)]">
        {previewSrc ? (
          <iframe
            key={previewSrc}
            src={previewSrc}
            title="Public profile phone preview"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setFrameReady(true)}
            className="h-full w-full border-0 bg-background"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-background px-4 text-center text-sm text-muted-foreground">
            {loading ? "Loading preview..." : error ?? "Preview unavailable."}
          </div>
        )}
        {previewSrc && (loading || !frameReady) ? (
          <PublicProfilePreviewLoadingState />
        ) : null}
        {error && previewSrc ? (
          <div className="absolute inset-x-3 bottom-3 z-30 rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PublicProfilePreviewLoadingState() {
  return (
    <div
      className="absolute inset-0 z-10 overflow-hidden bg-background/90 backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
      aria-label="Loading public profile preview"
    >
      <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-[-40px] h-48 w-48 rounded-full bg-accent/25 blur-3xl" />

      <div className="relative flex h-full flex-col items-center justify-start gap-4 px-5 py-4">
        <div className="relative w-full max-w-[285px] overflow-hidden rounded-[30px] border border-border/60 bg-card/80 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.65)]">
          <div className="relative h-24 w-full overflow-hidden">
            <Image
              src="/mockups/profile-header.jpg"
              alt=""
              fill
              aria-hidden
              sizes="285px"
              className="object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/45" />
          </div>

          <div className="relative -mt-10 flex flex-col items-center px-4 pb-5">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border-4 border-[var(--avatar-border)] bg-background shadow-lg">
              <Image
                src="/brand/logo-mark.png"
                alt=""
                width={64}
                height={64}
                aria-hidden
                className="h-16 w-16 object-contain landing-float"
              />
            </div>
            <div className="mt-3 h-3 w-36 rounded-full bg-muted/80 animate-pulse" />
            <div className="mt-2 h-2.5 w-24 rounded-full bg-muted/70 animate-pulse [animation-delay:180ms]" />
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
            Loading Preview
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary/70 animate-pulse [animation-delay:0ms]" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/55 animate-pulse [animation-delay:180ms]" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/40 animate-pulse [animation-delay:360ms]" />
          </div>
        </div>
      </div>

      <span className="sr-only">Loading public profile preview.</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}
