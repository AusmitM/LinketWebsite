"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { UserAnalytics } from "@/lib/analytics-service";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Download } from "lucide-react";

const numberFormatter = new Intl.NumberFormat("en-US");
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

const RANGES = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

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

export default function AnalyticsContent() {
  const [userId, setUserId] = useState<string | null>(null);
  const [range, setRange] = useState<number>(30);
  const [{ loading, error, analytics }, setState] = useState<ViewState>({ loading: true, error: null, analytics: null });

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
  }, [userId, range]);

  const totals = analytics?.totals;

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
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Track scans, captured leads, and conversion trends.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((option) => (
            <Button
              key={option.value}
              variant={range === option.value ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setRange(option.value)}
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
          <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Scans in range"
          value={analytics ? numberFormatter.format(rangeTotals.scans) : loading ? "—" : "0"}
          helper={`Last ${range} days`}
        />
        <StatCard
          label="Leads in range"
          value={analytics ? numberFormatter.format(rangeTotals.leads) : loading ? "—" : "0"}
          helper={`Last ${range} days`}
        />
        <StatCard
          label="Conversion"
          value={analytics ? `${(rangeTotals.conversion * 100).toFixed(1)}%` : loading ? "—" : "0%"}
          helper="Leads ÷ scans"
        />
        <StatCard
          label="Active Linkets"
          value={totals ? numberFormatter.format(totals.activeTags) : loading ? "—" : "0"}
          helper="Tags with at least one scan"
        />
      </section>

      <Card className="dashboard-analytics-card rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Scans and leads</CardTitle>
          <p className="text-sm text-muted-foreground">Daily totals for the selected window.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="dashboard-skeleton h-72 w-full animate-pulse rounded-2xl bg-muted" data-skeleton />
          ) : chartData.length === 0 ? (
            <EmptyState message="No scans recorded in this range." />
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
            <EmptyState message="No data available." />
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
              <EmptyState message="No scans in this range." />
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
};

function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <Card className="dashboard-analytics-card rounded-3xl border bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
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

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-2xl border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">{message}</p>;
}
