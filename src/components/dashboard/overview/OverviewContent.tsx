"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Calendar,
  Link as LinkIcon,
  MapPin,
  MessageSquare,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import { supabase } from "@/lib/supabase";
import PublicProfilePreview from "@/components/public/PublicProfilePreview";
import type { UserAnalytics } from "@/lib/analytics-service";
import type { ProfileWithLinks } from "@/lib/profile-service";

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});
const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
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

type TimeRange = "week" | "month" | "quarter" | "year";

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  message: string | null;
  created_at: string;
};

export default function OverviewContent() {
  const dashboardUser = useDashboardUser();
  const userId = dashboardUser?.id ?? null;
  const [{ loading, error, analytics }, setState] = useState<ViewState>({
    loading: true,
    error: null,
    analytics: null,
  });
  const [now, setNow] = useState(() => new Date());
  const [recentLeads, setRecentLeads] = useState<LeadRow[]>([]);
  const [recentLeadsLoading, setRecentLeadsLoading] = useState(true);
  const [recentLeadsError, setRecentLeadsError] = useState<string | null>(null);
  const [tapRange, setTapRange] = useState<TimeRange>("month");
  const [conversionRange, setConversionRange] = useState<TimeRange>("month");

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

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
        const analyticsUrl = `/api/analytics/supabase?userId=${encodeURIComponent(
          resolvedUserId
        )}&days=90`;
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
  }, [userId]);

  const totals = analytics?.totals;
  const timeline = analytics?.timeline ?? [];
  const leads = analytics?.recentLeads ?? [];

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

  useEffect(() => {
    if (!userId) {
      setRecentLeads([]);
      setRecentLeadsLoading(false);
      setRecentLeadsError(userId === null ? "Sign in to see leads." : null);
      return;
    }

    let active = true;
    setRecentLeadsLoading(true);
    setRecentLeadsError(null);

    (async () => {
      try {
        const { data, error: leadsError } = await supabase
          .from("leads")
          .select("id,name,email,company,message,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!active) return;
        if (leadsError) throw leadsError;
        setRecentLeads((data as LeadRow[]) ?? []);
        setRecentLeadsLoading(false);
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : "Unable to load leads.";
        setRecentLeadsError(message);
        setRecentLeads([]);
        setRecentLeadsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  const [dateLabel, setDateLabel] = useState<string>("");

  useEffect(() => {
    setDateLabel(dateTimeFormatter.format(new Date()));
  }, []);

  const rangeDays: Record<TimeRange, number> = {
    week: 7,
    month: 30,
    quarter: 90,
    year: 365,
  };

  const tapData = useMemo(() => {
    const days = rangeDays[tapRange];
    const sliced = timeline.slice(-Math.min(days, timeline.length));
    return sliced.map((point) => ({
      ...point,
      label: shortDate.format(new Date(point.date)),
    }));
  }, [timeline, tapRange]);

  const conversionData = useMemo(() => {
    const days = rangeDays[conversionRange];
    const sliced = timeline.slice(-Math.min(days, timeline.length));
    return sliced.map((point) => ({
      ...point,
      label: shortDate.format(new Date(point.date)),
      conversion: point.scans > 0 ? point.leads / point.scans : 0,
    }));
  }, [timeline, conversionRange]);

  const leads7d = sumRange(timeline, 7, (point) => point.leads);
  const prevLeads7d = sumRange(
    timeline.slice(0, Math.max(timeline.length - 7, 0)),
    7,
    (point) => point.leads
  );
  const leadDelta =
    prevLeads7d > 0 ? (leads7d - prevLeads7d) / prevLeads7d : null;

  const tapsByProfile = analytics?.topProfiles ?? [];
  const maxTap = Math.max(
    1,
    ...tapsByProfile.map((profile) => profile.scans)
  );

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
            <CardContent className="dashboard-overview-metrics grid grid-cols-2 gap-4 sm:grid-cols-1">
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
                            {lead.company ? ` · ${lead.company}` : ""}
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

        <Card className="rounded-3xl border border-border/70 bg-card/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)] lg:col-span-12">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground">
              Analytics
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Monitor engagement, conversions, and lead capture impact.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <AnalyticsTile
                title="Tap trend"
                icon={Sparkles}
                range={tapRange}
                onRangeChange={setTapRange}
                loading={loading && !analytics}
              >
                <ChartPanel data={tapData} dataKey="scans" />
              </AnalyticsTile>
              <AnalyticsTile
                title="Conversion rate trend"
                icon={BarChart3}
                range={conversionRange}
                onRangeChange={setConversionRange}
                loading={loading && !analytics}
              >
                <ChartPanel data={conversionData} dataKey="conversion" />
              </AnalyticsTile>
              <AnalyticsTile title="Taps per link" icon={LinkIcon}>
                <div className="space-y-3">
                  {tapsByProfile.length === 0 ? (
                    <EmptyState message="No taps recorded yet." />
                  ) : (
                    tapsByProfile.slice(0, 5).map((profile) => (
                      <div key={profile.handle ?? profile.profileId ?? "tap"}>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate">
                            {profile.displayName || "Linket"}
                          </span>
                          <span className="text-foreground">
                            {numberFormatter.format(profile.scans)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{
                              width: `${Math.max(
                                8,
                                (profile.scans / maxTap) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </AnalyticsTile>
              <AnalyticsTile title="Leads captured" icon={Users}>
                <div className="space-y-2">
                  <div className="text-4xl font-semibold text-foreground">
                    {totals
                      ? numberFormatter.format(totals.leads7d)
                      : "--"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last 7 days
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {leadDelta === null
                      ? "Delta unavailable"
                      : `${leadDelta > 0 ? "+" : ""}${percentFormatter.format(
                          leadDelta
                        )} vs previous period`}
                  </div>
                </div>
              </AnalyticsTile>
            </div>

            <div className="rounded-3xl border border-dashed border-border/70 bg-gradient-to-br from-muted/40 via-background to-muted/40 p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <MapPin className="h-4 w-4 text-primary" aria-hidden />
                Location map of taps
              </div>
              <div className="flex h-56 items-center justify-center rounded-2xl border border-border/60 bg-background/60 text-sm text-muted-foreground">
                Map placeholder
              </div>
            </div>
          </CardContent>
        </Card>
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

function AnalyticsTile({
  title,
  icon: Icon,
  children,
  range,
  onRangeChange,
  loading,
}: {
  title: string;
  icon: typeof Sparkles;
  children: React.ReactNode;
  range?: TimeRange;
  onRangeChange?: (range: TimeRange) => void;
  loading?: boolean;
}) {
  return (
    <div className="dashboard-analytics-tile rounded-3xl border border-border/60 bg-background/70 p-4 shadow-sm">
      <div className="dashboard-analytics-tile-header flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">{title}</div>
          </div>
        </div>
        {range && onRangeChange ? (
          <div className="dashboard-analytics-range flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-1 text-xs">
            {(["week", "month", "quarter", "year"] as TimeRange[]).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onRangeChange(option)}
                  className={`dashboard-analytics-range-button rounded-full px-2 py-0.5 text-xs font-medium transition ${
                    range === option
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={range === option}
                >
                  {labelForRange(option)}
                </button>
              )
            )}
          </div>
        ) : null}
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="dashboard-skeleton h-40 animate-pulse rounded-2xl bg-muted" data-skeleton />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function PublicProfilePreviewPanel({ userId }: { userId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileWithLinks | null>(null);
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
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [accountRes, profilesRes] = await Promise.all([
          fetch(`/api/account/handle?userId=${encodeURIComponent(userId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/linket-profiles?userId=${encodeURIComponent(userId)}`, {
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
        setProfile(activeProfile);
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Preview unavailable.");
        setProfile(null);
        setAccount(null);
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
          />
        </div>
      </div>
    </div>
  );
}

function ChartPanel({
  data,
  dataKey,
}: {
  data: Array<{ label: string; [key: string]: number | string }>;
  dataKey: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border/70 text-xs text-muted-foreground">
        No data yet
      </div>
    );
  }
  return (
    <div className="dashboard-analytics-chart-panel h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid
            stroke="rgba(148, 163, 184, 0.2)"
            strokeDasharray="6 4"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 10, fill: "currentColor" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 10, fill: "currentColor" }}
            tickFormatter={(value) =>
              dataKey === "conversion"
                ? percentFormatter.format(value)
                : numberFormatter.format(value)
            }
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="var(--primary)"
            fill="var(--primary)"
            strokeWidth={2}
            fillOpacity={0.18}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div className="rounded-md border border-border/70 bg-background/95 px-3 py-2 text-xs shadow">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 text-muted-foreground">
        {typeof value === "number"
          ? numberFormatter.format(value)
          : String(value)}
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

function labelForRange(range: TimeRange) {
  switch (range) {
    case "week":
      return "Week";
    case "month":
      return "Month";
    case "quarter":
      return "3 Months";
    case "year":
      return "Year";
    default:
      return "Range";
  }
}

function sumRange(
  points: Array<{ date: string; scans: number; leads: number }>,
  days: number,
  selector: (point: { date: string; scans: number; leads: number }) => number
) {
  const subset = points.slice(-Math.min(days, points.length));
  return subset.reduce((total, point) => total + selector(point), 0);
}
