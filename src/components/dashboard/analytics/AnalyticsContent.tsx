"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const mobileDate = new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" });

const RANGES = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;
const DEFAULT_RANGE = 30;
const ANALYTICS_RANGE_STORAGE_KEY = "linket:analytics:range";
const ANALYTICS_CACHE_TTL_MS = 60_000;

type TimelineDatum = {
  date: string;
  label: string;
  scans: number | null;
  leads: number | null;
};

type ConversionDatum = {
  date: string;
  label: string;
  rate: number;
};

type ViewState = {
  loading: boolean;
  error: string | null;
  analytics: UserAnalytics | null;
};

type CachedAnalyticsEntry = {
  fetchedAt: number;
  payload: UserAnalytics;
};

type DeltaBadge = {
  text: string;
  tone: "up" | "down" | "neutral";
};

export default function AnalyticsContent() {
  const [userId, setUserId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isPhone, setIsPhone] = useState(false);
  const [range, setRange] = useState<number>(DEFAULT_RANGE);
  const [hasLoadedPersistedRange, setHasLoadedPersistedRange] = useState(false);
  const analyticsCacheRef = useRef<Map<string, CachedAnalyticsEntry>>(new Map());
  const analyticsInFlightRef = useRef<Map<string, Promise<UserAnalytics>>>(new Map());
  const lastReloadTokenRef = useRef(0);

  useEffect(() => {
    const saved = Number(readLocalStorage(ANALYTICS_RANGE_STORAGE_KEY));
    if (
      Number.isFinite(saved) &&
      RANGES.some((option) => option.value === saved)
    ) {
      setRange(saved);
    }
    setHasLoadedPersistedRange(true);
  }, []);
  const [{ loading, error, analytics }, setState] = useState<ViewState>({ loading: true, error: null, analytics: null });

  useEffect(() => {
    if (!hasLoadedPersistedRange) return;
    writeLocalStorage(ANALYTICS_RANGE_STORAGE_KEY, String(range));
  }, [hasLoadedPersistedRange, range]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const update = () => setIsPhone(mediaQuery.matches);
    update();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

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

  const fetchAnalyticsForRange = useCallback(
    async (activeUserId: string, days: number, timezoneOffsetMinutes: number) => {
      const cacheKey = `${activeUserId}:${days}:${timezoneOffsetMinutes}`;
      const inFlight = analyticsInFlightRef.current.get(cacheKey);
      if (inFlight) return inFlight;

      const request = (async () => {
        const analyticsUrl = `/api/analytics/supabase?userId=${encodeURIComponent(activeUserId)}&days=${days}&tzOffsetMinutes=${encodeURIComponent(String(timezoneOffsetMinutes))}`;
        const response = await fetch(analyticsUrl, { cache: "no-store" });
        if (!response.ok) {
          const info = await response.json().catch(() => ({}));
          throw new Error(info?.error || `Analytics request failed (${response.status})`);
        }
        const payload = (await response.json()) as UserAnalytics;
        analyticsCacheRef.current.set(cacheKey, { fetchedAt: Date.now(), payload });
        return payload;
      })();

      analyticsInFlightRef.current.set(cacheKey, request);
      try {
        return await request;
      } finally {
        analyticsInFlightRef.current.delete(cacheKey);
      }
    },
    []
  );

  const prefetchOtherRanges = useCallback(
    (activeUserId: string, activeRange: number, timezoneOffsetMinutes: number) => {
      for (const option of RANGES) {
        if (option.value === activeRange) continue;
        const cacheKey = `${activeUserId}:${option.value}:${timezoneOffsetMinutes}`;
        const cached = analyticsCacheRef.current.get(cacheKey);
        const isFresh = cached ? Date.now() - cached.fetchedAt < ANALYTICS_CACHE_TTL_MS : false;
        if (isFresh) continue;
        void fetchAnalyticsForRange(activeUserId, option.value, timezoneOffsetMinutes).catch(() => undefined);
      }
    },
    [fetchAnalyticsForRange]
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const timezoneOffsetMinutes = new Date().getTimezoneOffset();
    const cacheKey = `${userId}:${range}:${timezoneOffsetMinutes}`;
    const cached = analyticsCacheRef.current.get(cacheKey);
    const isCacheFresh = cached ? Date.now() - cached.fetchedAt < ANALYTICS_CACHE_TTL_MS : false;
    const hasForcedRefresh = reloadToken !== lastReloadTokenRef.current;
    lastReloadTokenRef.current = reloadToken;

    if (cached) {
      setState({
        loading: false,
        error: cached.payload.meta.available ? null : "Analytics requires a configured Supabase service role key.",
        analytics: cached.payload,
      });
      if (isCacheFresh && !hasForcedRefresh) {
        prefetchOtherRanges(userId, range, timezoneOffsetMinutes);
        return () => {
          cancelled = true;
        };
      }
    } else {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    async function load() {
      try {
        if (!userId) throw new Error("User ID is missing");
        const payload = await fetchAnalyticsForRange(userId, range, timezoneOffsetMinutes);
        if (!cancelled) {
          setState({
            loading: false,
            error: payload.meta.available ? null : "Analytics requires a configured Supabase service role key.",
            analytics: payload,
          });
          prefetchOtherRanges(userId, range, timezoneOffsetMinutes);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load analytics";
        if (!cancelled) {
          if (cached) {
            setState((prev) => ({ ...prev, loading: false, error: message }));
          } else {
            setState({ loading: false, error: message, analytics: null });
          }
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchAnalyticsForRange, prefetchOtherRanges, reloadToken, range, userId]);

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

  const chartData: TimelineDatum[] = useMemo(() => {
    if (!analytics) return [];
    return analytics.timeline.map((point) => ({
      date: point.date,
      label: formatTimelineLabel(point.date),
      scans: point.scans,
      leads: point.leads,
    }));
  }, [analytics]);
  const currentTimelineDate =
    chartData.length > 0 ? chartData[chartData.length - 1].date : null;

  const rangeTotals = useMemo(() => {
    if (!analytics) return { scans: 0, leads: 0, conversion: 0 };
    const scans = analytics.timeline.reduce((acc, point) => acc + point.scans, 0);
    const leads = analytics.timeline.reduce((acc, point) => acc + point.leads, 0);
    const conversion = scans > 0 ? leads / scans : 0;
    return { scans, leads, conversion };
  }, [analytics]);

  const conversionSeries: ConversionDatum[] = useMemo(() => {
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
    <div className="dashboard-analytics-page w-full space-y-6" data-tour="analytics-overview">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Track scans, captured leads, and conversion trends.</p>
        </div>
        <div className="dashboard-analytics-range flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0">
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
            className="rounded-full shrink-0"
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

      <section className="dashboard-analytics-summary-grid grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          <CardTitle className="text-lg font-semibold">Scans and leads</CardTitle>
          <p className="text-sm text-muted-foreground">Daily totals for the selected window through today.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="dashboard-skeleton h-64 w-full animate-pulse rounded-2xl bg-muted sm:h-72" data-skeleton />
          ) : chartData.length === 0 ? (
            <EmptyState
              message="No scans recorded in this range."
              actionLabel="Refresh"
              onAction={() => setReloadToken((value) => value + 1)}
            />
          ) : isPhone ? (
            <PhoneScansLeadsChart data={chartData} />
          ) : (
            <div className="dashboard-analytics-chart h-64 w-full sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={isPhone ? { left: -10, right: 14, top: 8, bottom: 0 } : { left: 0, right: 14, top: 12, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={isPhone ? 30 : 22}
                    interval="preserveStartEnd"
                    tickMargin={isPhone ? 6 : 8}
                    tick={{ fontSize: isPhone ? 10 : 12 }}
                    className="text-xs text-muted-foreground"
                  />
                  <YAxis
                    tickFormatter={(val) => numberFormatter.format(val as number)}
                    tickLine={false}
                    axisLine={false}
                    width={isPhone ? 36 : 48}
                    tickCount={isPhone ? 4 : 6}
                    allowDecimals={false}
                    tick={{ fontSize: isPhone ? 10 : 12 }}
                    className="text-xs text-muted-foreground"
                  />
                  <Tooltip content={<SeriesTooltip />} wrapperStyle={{ outline: "none" }} />
                  <Legend
                    iconSize={isPhone ? 8 : 10}
                    wrapperStyle={{ fontSize: isPhone ? "0.68rem" : "0.75rem" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="scans"
                    name="Scans"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={
                      <CurrentTimelineDot
                        targetDate={currentTimelineDate}
                        color="var(--primary)"
                      />
                    }
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="leads"
                    name="Leads"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={
                      <CurrentTimelineDot
                        targetDate={currentTimelineDate}
                        color="var(--accent)"
                      />
                    }
                    connectNulls={false}
                  />
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
            <div className="dashboard-skeleton h-52 w-full animate-pulse rounded-2xl bg-muted sm:h-56" data-skeleton />
          ) : conversionSeries.length === 0 ? (
            <EmptyState
              message="No data available yet."
              actionLabel="Try 90 days"
              onAction={() => setRange(90)}
            />
          ) : isPhone ? (
            <PhoneConversionTrend data={conversionSeries} />
          ) : (
            <div className="dashboard-analytics-chart h-52 w-full sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={conversionSeries}
                  margin={isPhone ? { left: -8, right: 14, top: 8, bottom: 0 } : { left: 0, right: 14, top: 12, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={isPhone ? 30 : 22}
                    interval="preserveStartEnd"
                    tickMargin={isPhone ? 6 : 8}
                    tick={{ fontSize: isPhone ? 10 : 12 }}
                    className="text-xs text-muted-foreground"
                  />
                  <YAxis
                    tickFormatter={(val) => `${(Number(val) * 100).toFixed(0)}%`}
                    tickLine={false}
                    axisLine={false}
                    width={isPhone ? 40 : 50}
                    tickCount={isPhone ? 4 : 6}
                    tick={{ fontSize: isPhone ? 10 : 12 }}
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
              <div className="space-y-3">
                {analytics.topLinks.map((link) => {
                  const clickShare =
                    topLinksTotalClicks > 0 ? link.clicks / topLinksTotalClicks : 0;
                  const sharePercent = clickShare * 100;
                  const barPercent =
                    link.clicks > 0 ? Math.max(4, Math.round(sharePercent)) : 0;
                  const displayUrl = formatLinkUrl(link.url);
                  return (
                    <div
                      key={link.id}
                      className="space-y-3 rounded-2xl border border-border/70 bg-background/20 px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="truncate text-base font-semibold text-foreground">
                            {link.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            {link.handle ? (
                              <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80">
                                {link.handle}
                              </span>
                            ) : null}
                            <span className="min-w-0 truncate">{displayUrl}</span>
                          </div>
                        </div>
                        <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground sm:flex-col sm:items-end sm:justify-start sm:gap-0.5">
                          <div className="text-base font-semibold text-foreground">
                            {numberFormatter.format(link.clicks)} clicks
                          </div>
                          <div>{sharePercent.toFixed(1)}% share</div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                          <span>Share</span>
                          <span>{sharePercent.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted/80">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${barPercent}%` }}
                          />
                        </div>
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
    <Card className="dashboard-analytics-card min-w-0 rounded-3xl border bg-card/80 shadow-sm">
      <CardHeader className="flex-col items-center justify-center gap-2 space-y-0 text-center sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:text-left sm:gap-3">
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
      <CardContent className="space-y-1 text-center sm:text-left">
        <div className="text-2xl font-semibold text-foreground sm:text-3xl">{value}</div>
        {helper && <div className="text-xs text-muted-foreground">{helper}</div>}
      </CardContent>
    </Card>
  );
}

function PhoneScansLeadsChart({ data }: { data: TimelineDatum[] }) {
  const points = data.slice(-7);
  const maxValue = Math.max(
    1,
    ...points.map((point) => Math.max(point.scans ?? 0, point.leads ?? 0))
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Scans
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Leads
        </span>
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
      >
        {points.map((point) => {
          const scans = point.scans ?? 0;
          const leads = point.leads ?? 0;
          const scansHeight = scans > 0 ? Math.max(6, Math.round((scans / maxValue) * 100)) : 0;
          const leadsHeight = leads > 0 ? Math.max(6, Math.round((leads / maxValue) * 100)) : 0;
          return (
            <div key={point.date} className="space-y-1">
              <div className="flex h-28 items-end justify-center gap-1 rounded-xl border bg-muted/25 px-1.5 py-2">
                <div
                  className="w-2 rounded-full bg-primary/90"
                  style={{ height: `${scansHeight}%` }}
                  aria-label={`${scans} scans`}
                />
                <div
                  className="w-2 rounded-full bg-accent/90"
                  style={{ height: `${leadsHeight}%` }}
                  aria-label={`${leads} leads`}
                />
              </div>
              <div className="text-center text-[10px] font-medium text-muted-foreground">
                {formatMobileDate(point.date)}
              </div>
              <div className="text-center text-[9px] leading-tight">
                <span className="block font-medium text-primary">{numberFormatter.format(scans)} scans</span>
                <span className="block font-medium text-accent">{numberFormatter.format(leads)} leads</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhoneConversionTrend({ data }: { data: ConversionDatum[] }) {
  const points = data.slice(-7);

  return (
    <div className="space-y-2.5">
      {points.map((point) => {
        const percent = Math.max(0, Math.min(100, point.rate * 100));
        const barWidth = percent > 0 ? Math.max(4, Math.round(percent)) : 0;
        return (
          <div key={point.date} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">{formatMobileDate(point.date)}</span>
              <span className="font-semibold text-foreground">{percent.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/70">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${barWidth}%` }}
                aria-label={`${percent.toFixed(1)}% conversion`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type SeriesTooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null }>;
  label?: string;
};

function SeriesTooltip({ active, payload, label }: SeriesTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const scans = payload.find((item) => item.name === "Scans")?.value ?? null;
  const leads = payload.find((item) => item.name === "Leads")?.value ?? null;
  const hasData = typeof scans === "number" || typeof leads === "number";
  return (
    <div className="rounded-md border border-border/70 bg-background/95 px-3 py-2 text-xs shadow">
      <div className="font-medium text-foreground">{label}</div>
      {hasData ? (
        <div className="mt-1 space-y-1">
          <div className="flex items-center justify-between gap-6">
            <span className="text-muted-foreground">Scans</span>
            <span className="font-medium text-foreground">{numberFormatter.format(scans ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="text-muted-foreground">Leads</span>
            <span className="font-medium text-foreground">{numberFormatter.format(leads ?? 0)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-1 text-muted-foreground">No data yet.</div>
      )}
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

function formatTimelineLabel(date: string) {
  const [year, month, day] = date.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return shortDate.format(new Date(date));
  }
  return shortDate.format(new Date(year, month - 1, day));
}

function formatMobileDate(date: string) {
  const [year, month, day] = date.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return mobileDate.format(new Date(date));
  }
  return mobileDate.format(new Date(year, month - 1, day));
}

function formatLinkUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${host}${path}${parsed.search}`;
  } catch {
    return url.replace(/^https?:\/\//i, "");
  }
}

type CurrentTimelineDotProps = {
  cx?: number;
  cy?: number;
  payload?: TimelineDatum;
  targetDate: string | null;
  color: string;
};

function CurrentTimelineDot({
  cx,
  cy,
  payload,
  targetDate,
  color,
}: CurrentTimelineDotProps) {
  if (
    !targetDate ||
    !payload ||
    payload.date !== targetDate ||
    typeof cx !== "number" ||
    typeof cy !== "number"
  ) {
    return null;
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={color}
      stroke="var(--background)"
      strokeWidth={2}
    />
  );
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

