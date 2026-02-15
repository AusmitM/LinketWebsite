"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { useThemeOptional } from "@/components/theme/theme-provider";
import PublicProfilePreview from "@/components/public/PublicProfilePreview";
import { ANALYTICS_BROADCAST_KEY, ANALYTICS_EVENT_NAME } from "@/lib/analytics";
import type { UserAnalytics } from "@/lib/analytics-service";
import type { ProfileWithLinks } from "@/lib/profile-service";

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

        <div className="lg:col-span-5">
          <Card className="h-full rounded-3xl border border-border/70 bg-card/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <CardContent className="flex h-full items-stretch p-6">
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
  const { theme } = useThemeOptional();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileWithLinks | null>(null);
  const [hasContactDetails, setHasContactDetails] = useState(false);
  const [account, setAccount] = useState<{
    handle: string;
    displayName: string | null;
    avatarPath: string | null;
    avatarUpdatedAt: string | null;
  } | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("Sign in to see your live preview.");
      setProfile(null);
      setAccount(null);
      setHasContactDetails(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setHasContactDetails(false);

    (async () => {
      try {
        const [accountRes, profilesRes, vcardRes] = await Promise.all([
          fetch(`/api/account/handle?userId=${encodeURIComponent(userId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/linket-profiles?userId=${encodeURIComponent(userId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/vcard/profile?userId=${encodeURIComponent(userId)}`, {
            cache: "no-store",
          }),
        ]);

        if (!accountRes.ok) {
          const info = await accountRes.json().catch(() => ({}));
          throw new Error(info?.error || "Unable to load account.");
        }
        if (!profilesRes.ok) {
          const info = await profilesRes.json().catch(() => ({}));
          throw new Error(info?.error || "Unable to load profile.");
        }

        const accountPayload = (await accountRes.json()) as {
          handle?: string | null;
          displayName?: string | null;
          avatarPath?: string | null;
          avatarUpdatedAt?: string | null;
        };
        const profiles = (await profilesRes.json()) as ProfileWithLinks[];
        const activeProfile =
          profiles.find((item) => item.is_active) ?? profiles[0];
        let nextHasContactDetails = false;
        if (vcardRes.ok) {
          const vcardPayload = (await vcardRes.json()) as {
            fields?: { email?: string | null; phone?: string | null };
          };
          nextHasContactDetails = Boolean(
            vcardPayload.fields?.email?.trim() || vcardPayload.fields?.phone?.trim()
          );
        }

        if (!activeProfile) {
          throw new Error("Create a public profile to see the preview.");
        }

        if (!active) return;
        setAccount({
          handle: accountPayload?.handle || activeProfile.handle,
          displayName: accountPayload?.displayName ?? null,
          avatarPath: accountPayload?.avatarPath ?? null,
          avatarUpdatedAt: accountPayload?.avatarUpdatedAt ?? null,
        });
        setHasContactDetails(nextHasContactDetails);
        setProfile(activeProfile);
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Preview unavailable.");
        setProfile(null);
        setAccount(null);
        setHasContactDetails(false);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[36px] border border-border/60 bg-background text-sm text-muted-foreground shadow-[0_20px_40px_-30px_rgba(15,23,42,0.3)]">
        Loading preview...
      </div>
    );
  }

  if (!profile || !account) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[36px] border border-border/60 bg-background text-sm text-muted-foreground shadow-[0_20px_40px_-30px_rgba(15,23,42,0.3)]">
        {error ?? "Preview unavailable."}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-full w-full max-w-sm overflow-hidden rounded-[36px] border border-border/60 bg-background shadow-[0_20px_40px_-30px_rgba(15,23,42,0.3)]">
        <div className="h-full w-full overflow-y-auto">
          <PublicProfilePreview
            profile={profile}
            account={account}
            handle={account.handle || profile.handle}
            layout="stacked"
            forceMobile
            themeOverride={theme}
            contactEnabled={hasContactDetails}
          />
        </div>
      </div>
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
