"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { readLocalStorage, writeLocalStorage } from "@/lib/browser-storage";
import { ANALYTICS_BROADCAST_KEY, ANALYTICS_EVENT_NAME } from "@/lib/analytics";
import type { UserAnalytics } from "@/lib/analytics-service";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Download } from "lucide-react";

const numberFormatter = new Intl.NumberFormat("en-US");
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const longDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const RANGES = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;
const ANALYTICS_RANGE_STORAGE_KEY = "linket:analytics:range";

type TimelineDatum = {
  date: string;
  label: string;
  scans: number;
  leads: number;
};

type ViewState = {
  loading: boolean;
  error: string | null;
  analytics: UserAnalytics | null;
};

type DeltaBadge = {
  text: string;
  tone: "up" | "down" | "neutral";
};

export default function AnalyticsContent() {
  const [userId, setUserId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [range, setRange] = useState<number>(() => {
    const saved = Number(readLocalStorage(ANALYTICS_RANGE_STORAGE_KEY));
    if (
      Number.isFinite(saved) &&
      RANGES.some((option) => option.value === saved)
    ) {
      return saved;
    }
    return 30;
  });
  const [{ loading, error, analytics }, setState] = useState<ViewState>({ loading: true, error: null, analytics: null });

  useEffect(() => {
    writeLocalStorage(ANALYTICS_RANGE_STORAGE_KEY, String(range));
  }, [range]);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        const user = data.user;
        setUserId(user?.id ?? null);
        if (!user) {
          setState({ loading: false, error: "You're not signed in.", analytics: null });
        }
      })
      .catch(() => {
        if (active) setState({ loading: false, error: "Unable to verify session.", analytics: null });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    async function load() {
      try {
        if (!userId) throw new Error("User ID is missing");
        const analyticsUrl = `/api/analytics/supabase?userId=${encodeURIComponent(userId)}&days=${range}`;
        const response = await fetch(analyticsUrl, { cache: "no-store" });
        if (!response.ok) {
          const info = await response.json().catch(() => ({}));
          throw new Error(info?.error || `Analytics request failed (${response.status})`);
        }
        const payload = (await response.json()) as UserAnalytics;
        if (!cancelled) {
          setState({
            loading: false,
            error: payload.meta.available ? null : "Analytics requires a configured Supabase service role key.",
            analytics: payload,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load analytics";
        if (!cancelled) setState({ loading: false, error: message, analytics: null });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, range, reloadToken]);

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

  useEffect(() => {
    if (!userId) return;
    if (!canUseRealtime()) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let refreshTimer: number | null = null;
    let settleTimer: number | null = null;

    const requestRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        setReloadToken((value) => value + 1);
      }, 300);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        setReloadToken((value) => value + 1);
      }, 1200);
    };

    try {
      channel = supabase
        .channel(`analytics-live-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "leads", filter: `user_id=eq.${userId}` },
          requestRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profile_links", filter: `user_id=eq.${userId}` },
          requestRefresh
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "tag_assignments", filter: `user_id=eq.${userId}` },
          requestRefresh
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            console.warn("Realtime unavailable for analytics auto-refresh; continuing without live updates.");
          }
        });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown realtime error");
      console.warn(`Realtime disabled for analytics: ${message}`);
      channel = null;
    }

    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  const totals = analytics?.totals;
  const funnel = analytics?.funnel;

  const chartData: TimelineDatum[] = useMemo(() => {
    if (!analytics) return [];
    return analytics.timeline.map((point) => ({
      date: point.date,
      label: shortDate.format(new Date(point.date)),
      scans: point.scans,
      leads: point.leads,
    }));
  }, [analytics]);

  const rangeTotals = useMemo(() => {
    if (!analytics) return { scans: 0, leads: 0, conversion: 0 };
    const scans = analytics.timeline.reduce((acc, point) => acc + point.scans, 0);
    const leads = analytics.timeline.reduce((acc, point) => acc + point.leads, 0);
    const conversion = scans > 0 ? leads / scans : 0;
    return { scans, leads, conversion };
  }, [analytics]);

  const conversionSeries = useMemo(() => {
    if (!analytics) return [];
    return analytics.timeline.map((point) => ({
      date: point.date,
      label: shortDate.format(new Date(point.date)),
      rate: point.scans > 0 ? point.leads / point.scans : 0,
    }));
  }, [analytics]);

  const trendDeltas = useMemo(() => {
    if (!analytics || analytics.timeline.length === 0) return null;
    const points = analytics.timeline;
    const windowSize = Math.max(1, Math.floor(points.length / 2));
    const recentWindow = points.slice(-windowSize);
    const previousWindow = points.slice(-(windowSize * 2), -windowSize);
    if (!previousWindow.length) return null;

    const recent = summarizeTimelineWindow(recentWindow);
    const previous = summarizeTimelineWindow(previousWindow);

    return {
      scans: formatPercentDelta(recent.scans, previous.scans),
      leads: formatPercentDelta(recent.leads, previous.leads),
      conversion: formatRateDelta(recent.conversion, previous.conversion),
    };
  }, [analytics]);

  const topLinksTotalClicks = useMemo(() => {
    if (!analytics?.topLinks?.length) return 0;
    return analytics.topLinks.reduce((total, item) => total + item.clicks, 0);
  }, [analytics]);

  const handleExport = useCallback(() => {
    if (!analytics) return;
    const rows = ["date,scans,leads"].concat(
      analytics.timeline.map((point) => `${point.date},${point.scans},${point.leads}`)
    );
    const csv = rows.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `linket-analytics-${range}d.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [analytics, range]);

  return (
    <div className="space-y-6" data-tour="analytics-overview">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Track scans, captured leads, and conversion trends.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              size="sm"
              className={cn(
                "rounded-full dashboard-analytics-range-button transition",
                range === option.value
                  ? "border-accent bg-accent text-accent-foreground shadow-[0_16px_40px_rgba(0,0,0,0.25)] ring-2 ring-accent/40 ring-offset-2 ring-offset-background hover:bg-accent/90"
                  : "border-border/60 text-muted-foreground hover:border-accent/50 hover:text-foreground"
              )}
              onClick={() => setRange(option.value)}
              data-selected={range === option.value ? "true" : "false"}
            >
              {option.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={handleExport}
            disabled={!analytics || analytics.timeline.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </header>

      {error && (
        <Card className="dashboard-analytics-card rounded-3xl border bg-card/80 shadow-sm">
          <CardContent className="space-y-4 py-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Retry analytics
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Scans in range"
          value={analytics ? numberFormatter.format(rangeTotals.scans) : loading ? "--" : "0"}
          helper={`Last ${range} days`}
          delta={trendDeltas?.scans}
        />
        <StatCard
          label="Leads in range"
          value={analytics ? numberFormatter.format(rangeTotals.leads) : loading ? "--" : "0"}
          helper={`Last ${range} days`}
          delta={trendDeltas?.leads}
        />
        <StatCard
          label="Conversion"
          value={analytics ? `${(rangeTotals.conversion * 100).toFixed(1)}%` : loading ? "--" : "0%"}
          helper="Leads / scans"
          delta={trendDeltas?.conversion}
        />
        <StatCard
          label="Active Linkets"
          value={totals ? numberFormatter.format(totals.activeTags) : loading ? "--" : "0"}
          helper="Tags with at least one scan"
        />
      </section>

      <Card className="dashboard-analytics-card rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Onboarding funnel</CardTitle>
          <p className="text-sm text-muted-foreground">
            Landing CTA click - signup start - signup complete - first profile publish - first lead.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <div className="dashboard-skeleton h-4 w-44 animate-pulse rounded bg-muted" data-skeleton />
              <div className="dashboard-skeleton h-2 w-full animate-pulse rounded bg-muted" data-skeleton />
              <div className="dashboard-skeleton h-10 w-full animate-pulse rounded-2xl bg-muted" data-skeleton />
              <div className="dashboard-skeleton h-10 w-full animate-pulse rounded-2xl bg-muted" data-skeleton />
              <div className="dashboard-skeleton h-10 w-full animate-pulse rounded-2xl bg-muted" data-skeleton />
            </div>
          ) : !funnel || funnel.steps.length === 0 ? (
            <EmptyState message="No funnel data yet." />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Progress
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {funnel.completedSteps}/{funnel.totalSteps} steps
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round(funnel.completionRate * 100)}%` }}
                />
              </div>
              <div className="space-y-2">
                {funnel.steps.map((step) => (
                  <div
                    key={step.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {step.label}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {step.firstAt
                          ? `First seen ${longDate.format(new Date(step.firstAt))}`
                          : "Not completed yet"}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div className="font-semibold text-foreground">
                        {numberFormatter.format(step.eventCount)} events
                      </div>
                      {step.conversionFromPrevious !== null ? (
                        <div>
                          {(step.conversionFromPrevious * 100).toFixed(0)}% from prev
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dashboard-analytics-card rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Scans and leads</CardTitle>
          <p className="text-sm text-muted-foreground">Daily totals for the selected window.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="dashboard-skeleton h-72 w-full animate-pulse rounded-2xl bg-muted" data-skeleton />
          ) : chartData.length === 0 ? (
            <EmptyState
              message="No scans recorded in this range."
              actionLabel="Refresh"
              onAction={() => setReloadToken((value) => value + 1)}
            />
          ) : (
            <div className="dashboard-analytics-chart h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 0, right: 0, top: 12, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-muted" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} className="text-xs text-muted-foreground" />
                  <YAxis
                    tickFormatter={(val) => numberFormatter.format(val as number)}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    className="text-xs text-muted-foreground"
                  />
                  <Tooltip content={<SeriesTooltip />} wrapperStyle={{ outline: "none" }} />
                  <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                  <Line type="monotone" dataKey="scans" name="Scans" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="leads" name="Leads" stroke="var(--accent)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dashboard-analytics-card rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Conversion trend</CardTitle>
          <p className="text-sm text-muted-foreground">Lead capture rate per day.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="dashboard-skeleton h-56 w-full animate-pulse rounded-2xl bg-muted" data-skeleton />
          ) : conversionSeries.length === 0 ? (
            <EmptyState
              message="No data available yet."
              actionLabel="Try 90 days"
              onAction={() => setRange(90)}
            />
          ) : (
            <div className="dashboard-analytics-chart h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={conversionSeries} margin={{ left: 0, right: 0, top: 12, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-muted" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} className="text-xs text-muted-foreground" />
                  <YAxis
                    tickFormatter={(val) => `${(Number(val) * 100).toFixed(0)}%`}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                    className="text-xs text-muted-foreground"
                    domain={[0, 1]}
                  />
                  <Tooltip content={<ConversionTooltip />} wrapperStyle={{ outline: "none" }} />
                  <Line type="monotone" dataKey="rate" name="Conversion" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card className="dashboard-analytics-card rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top Linkets</CardTitle>
            <p className="text-sm text-muted-foreground">Scans and leads by assigned profile or tag.</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="dashboard-skeleton h-12 animate-pulse rounded-2xl bg-muted" data-skeleton />
                <div className="dashboard-skeleton h-12 animate-pulse rounded-2xl bg-muted" data-skeleton />
                <div className="dashboard-skeleton h-12 animate-pulse rounded-2xl bg-muted" data-skeleton />
              </div>
            ) : analytics?.topProfiles?.length ? (
              <div className="space-y-2">
                {analytics.topProfiles.map((profile) => {
                  const subtitle = profile.handle ? `linketconnect.com/${profile.handle}` : profile.nickname || "Unassigned";
                  const conversion = profile.scans > 0 ? profile.leads / profile.scans : 0;
                  return (
                    <div key={`${profile.profileId ?? "np"}-${profile.handle ?? "nh"}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-foreground">{profile.displayName || "Linket"}</div>
                        <p className="text-xs text-muted-foreground">{subtitle}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div className="font-semibold text-foreground">{numberFormatter.format(profile.scans)} scans</div>
                        <div>{profile.leads ? `${numberFormatter.format(profile.leads)} leads` : "0 leads"}</div>
                        <div>{(conversion * 100).toFixed(1)}% conversion</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                message="No scans in this range."
                actionLabel="Refresh"
                onAction={() => setReloadToken((value) => value + 1)}
              />
            )}
          </CardContent>
        </Card>

        <Card className="dashboard-analytics-card rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Link performance</CardTitle>
            <p className="text-sm text-muted-foreground">Clicks by active profile link.</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="dashboard-skeleton h-12 animate-pulse rounded-2xl bg-muted" data-skeleton />
                <div className="dashboard-skeleton h-12 animate-pulse rounded-2xl bg-muted" data-skeleton />
                <div className="dashboard-skeleton h-12 animate-pulse rounded-2xl bg-muted" data-skeleton />
              </div>
            ) : analytics?.topLinks?.length ? (
              <div className="space-y-2">
                {analytics.topLinks.map((link) => {
                  const clickShare =
                    topLinksTotalClicks > 0 ? link.clicks / topLinksTotalClicks : 0;
                  return (
                    <div key={link.id} className="space-y-2 rounded-2xl border px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {link.title}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {link.handle ? `${link.handle} • ` : ""}
                            {link.url}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div className="font-semibold text-foreground">
                            {numberFormatter.format(link.clicks)} clicks
                          </div>
                          <div>{(clickShare * 100).toFixed(1)}% share</div>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.max(4, Math.round(clickShare * 100))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                message="No link clicks yet."
                actionLabel="Refresh"
                onAction={() => setReloadToken((value) => value + 1)}
              />
            )}
          </CardContent>
        </Card>

      </section>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  delta?: DeltaBadge;
};

function StatCard({ label, value, helper, delta }: StatCardProps) {
  return (
    <Card className="dashboard-analytics-card rounded-3xl border bg-card/80 shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        {delta ? (
          <span
            className={cn(
              "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
              delta.tone === "up" && "bg-emerald-500/10 text-emerald-300",
              delta.tone === "down" && "bg-amber-500/10 text-amber-300",
              delta.tone === "neutral" && "bg-muted text-muted-foreground"
            )}
          >
            {delta.text}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-3xl font-semibold text-foreground">{value}</div>
        {helper && <div className="text-xs text-muted-foreground">{helper}</div>}
      </CardContent>
    </Card>
  );
}

type SeriesTooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
};

function SeriesTooltip({ active, payload, label }: SeriesTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const scans = payload.find((item) => item.name === "Scans")?.value ?? 0;
  const leads = payload.find((item) => item.name === "Leads")?.value ?? 0;
  return (
    <div className="rounded-md border border-border/70 bg-background/95 px-3 py-2 text-xs shadow">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Scans</span>
          <span className="font-medium text-foreground">{numberFormatter.format(scans)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Leads</span>
          <span className="font-medium text-foreground">{numberFormatter.format(leads)}</span>
        </div>
      </div>
    </div>
  );
}

type ConversionTooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
};

function ConversionTooltip({ active, payload, label }: ConversionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rate = payload[0]?.value ?? 0;
  return (
    <div className="rounded-md border border-border/70 bg-background/95 px-3 py-2 text-xs shadow">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 text-muted-foreground">{(Number(rate) * 100).toFixed(1)}% conversion</div>
    </div>
  );
}

function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed px-3 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionLabel && onAction ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

function summarizeTimelineWindow(points: UserAnalytics["timeline"]) {
  const scans = points.reduce((acc, point) => acc + point.scans, 0);
  const leads = points.reduce((acc, point) => acc + point.leads, 0);
  const conversion = scans > 0 ? leads / scans : 0;
  return { scans, leads, conversion };
}

function formatPercentDelta(current: number, previous: number): DeltaBadge {
  if (previous === 0 && current === 0) {
    return { text: "No change", tone: "neutral" };
  }
  if (previous === 0) {
    return { text: "New activity", tone: "up" };
  }
  const delta = ((current - previous) / previous) * 100;
  if (Math.abs(delta) < 0.1) {
    return { text: "No change", tone: "neutral" };
  }
  const precision = Math.abs(delta) >= 10 ? 0 : 1;
  const text = `${delta > 0 ? "+" : ""}${delta.toFixed(precision)}% vs prev`;
  return {
    text,
    tone: delta > 0 ? "up" : "down",
  };
}

function formatRateDelta(current: number, previous: number): DeltaBadge {
  const delta = (current - previous) * 100;
  if (Math.abs(delta) < 0.1) {
    return { text: "No change", tone: "neutral" };
  }
  return {
    text: `${delta > 0 ? "+" : ""}${delta.toFixed(1)}pp vs prev`,
    tone: delta > 0 ? "up" : "down",
  };
}

function canUseRealtime() {
  if (typeof window === "undefined") return false;
  if (typeof window.WebSocket !== "function") return false;
  if (window.isSecureContext) return true;

  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  );
}

