"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  BarChart3,
  Calendar,
  Download,
  Link as LinkIcon,
  Mail,
  MapPin,
  Plus,
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
import { Input } from "@/components/ui/input";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/system/toaster";
import type { UserAnalytics } from "@/lib/analytics-service";

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
  firstName: string;
  lastName: string;
  company: string;
  school: string;
  city: string;
  time: string;
  timeValue: number;
  email: string;
};

export default function OverviewContent() {
  const dashboardUser = useDashboardUser();
  const [userId, setUserId] = useState<string | null | undefined>(
    dashboardUser?.id ?? undefined
  );
  const [{ loading, error, analytics }, setState] = useState<ViewState>({
    loading: true,
    error: null,
    analytics: null,
  });
  const [now, setNow] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof LeadRow>("timeValue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [tapRange, setTapRange] = useState<TimeRange>("month");
  const [conversionRange, setConversionRange] = useState<TimeRange>("month");

  useEffect(() => {
    if (dashboardUser?.id) {
      setUserId(dashboardUser.id);
    }
  }, [dashboardUser]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        const id = session?.user?.id ?? null;
        setUserId(id);
        if (!session?.user) {
          setState({
            loading: false,
            error: "You're not signed in.",
            analytics: null,
          });
        }
      }
    );

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        const user = data.user;
        if (!user) return;
        setUserId(user.id);
      })
      .catch(() => {
        if (active)
          setState({
            loading: false,
            error: "Unable to verify session.",
            analytics: null,
          });
      });

    return () => {
      active = false;
      subscription.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (userId === undefined) return;
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
        const analyticsUrl = `/api/analytics/user?userId=${encodeURIComponent(
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

  const leadRows = useMemo<LeadRow[]>(() => {
    return leads.map((lead) => {
      const name = lead.name ?? "";
      const [firstName, ...lastParts] = name.trim().split(" ");
      const lastName = lastParts.join(" ");
      const created = new Date(lead.created_at);
      return {
        id: lead.id,
        firstName: firstName || "--",
        lastName: lastName || "--",
        company: lead.company ?? "--",
        school: "--",
        city: "--",
        time: timestampFormatter.format(created),
        timeValue: created.getTime(),
        email: lead.email ?? "",
      };
    });
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return leadRows;
    return leadRows.filter((row) =>
      [
        row.firstName,
        row.lastName,
        row.company,
        row.school,
        row.city,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [leadRows, search]);

  const sortedLeads = useMemo(() => {
    const rows = [...filteredLeads];
    rows.sort((a, b) => {
      const key = sortKey;
      const aVal = a[key];
      const bVal = b[key];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr === bStr) return 0;
      if (sortDirection === "asc") {
        return aStr < bStr ? -1 : 1;
      }
      return aStr > bStr ? -1 : 1;
    });
    return rows.slice(0, 10);
  }, [filteredLeads, sortKey, sortDirection]);

  const toggleSort = useCallback((key: keyof LeadRow) => {
    setSortKey((prevKey) => {
      if (prevKey !== key) {
        setSortDirection("asc");
        return key;
      }
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return key;
    });
  }, []);

  const exportCsv = useCallback(() => {
    if (filteredLeads.length === 0) {
      toast({ title: "No leads to export" });
      return;
    }
    const header = [
      "first_name",
      "last_name",
      "company",
      "school",
      "city",
      "time_acquired",
    ];
    const rows = filteredLeads.map((row) => [
      safeCsv(row.firstName),
      safeCsv(row.lastName),
      safeCsv(row.company),
      safeCsv(row.school),
      safeCsv(row.city),
      safeCsv(row.time),
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `linket-leads-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [filteredLeads]);

  const emailLeads = useCallback(() => {
    const emails = filteredLeads
      .map((row) => row.email)
      .filter(Boolean)
      .slice(0, 50);
    if (emails.length === 0) {
      toast({ title: "No emails available" });
      return;
    }
    const subject = encodeURIComponent("Following up from Linket");
    const bcc = encodeURIComponent(emails.join(","));
    window.location.href = `mailto:?subject=${subject}&bcc=${bcc}`;
  }, [filteredLeads]);

  const dateLabel = dateTimeFormatter.format(now);

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
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of taps, leads, analytics, and your public profile.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm">
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

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Card className="rounded-3xl border border-border/70 bg-card/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg font-semibold text-foreground">
                Overview
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Your latest Linket performance snapshot.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4">
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

          <Card className="rounded-3xl border border-border/70 bg-card/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
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
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="rounded-full"
                    onClick={exportCsv}
                    disabled={loading}
                  >
                    <Download className="mr-2 h-4 w-4" aria-hidden />
                    Download CSV
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={emailLeads}
                    disabled={loading}
                  >
                    <Mail className="mr-2 h-4 w-4" aria-hidden />
                    Email leads
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, company, school, city"
                    className="rounded-full pr-4"
                    aria-label="Search leads"
                  />
                </div>
                <Button
                  asChild
                  variant="ghost"
                  className="text-sm text-primary hover:text-primary/80"
                >
                  <Link href="/dashboard/leads">View all</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading && !analytics ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`lead-skeleton-${index}`}
                      className="h-10 animate-pulse rounded-2xl bg-muted"
                    />
                  ))}
                </div>
              ) : sortedLeads.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-border/60">
                  <table className="min-w-[640px] table-auto text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        {[
                          { key: "firstName", label: "First name" },
                          { key: "lastName", label: "Last name" },
                          { key: "company", label: "Company" },
                          { key: "school", label: "School" },
                          { key: "city", label: "City" },
                          { key: "timeValue", label: "Time acquired" },
                        ].map((column) => (
                          <th key={column.key} className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                toggleSort(column.key as keyof LeadRow)
                              }
                              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                            >
                              {column.label}
                              <ArrowUpDown className="h-3 w-3" aria-hidden />
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 bg-card/60">
                      {sortedLeads.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 text-foreground">
                            {row.firstName}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {row.lastName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {row.company}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {row.school}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {row.city}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {row.time}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No leads match this search yet." />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5">
          <Card className="h-full rounded-3xl border border-border/70 bg-card/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <CardContent className="flex h-full items-start justify-center p-6">
              <PublicProfileMock />
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold text-foreground">
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
    <div className="rounded-3xl border border-border/60 bg-background/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">{title}</div>
          </div>
        </div>
        {range && onRangeChange ? (
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-1 text-xs">
            {(["week", "month", "quarter", "year"] as TimeRange[]).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onRangeChange(option)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
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
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function PublicProfileMock() {
  return (
    <div className="h-fit w-full max-w-[340px] overflow-hidden rounded-[36px] border border-border/60 bg-background shadow-[0_20px_40px_-30px_rgba(15,23,42,0.3)]">
      <div className="h-28 rounded-t-[36px] bg-gradient-to-r from-[#7C4DA0] via-[#B26A85] to-[#E1A37B]" />
      <div className="flex flex-col items-center px-6 pb-6">
        <div className="-mt-10 h-20 w-20 overflow-hidden rounded-full border-4 border-background bg-muted shadow-sm" />
        <div className="mt-3 text-center">
          <div className="text-base font-semibold text-foreground">
            Jessica Miller
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Digital Creator | Connecting Ideas & Communities
          </div>
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-full bg-[#EEF3F9] px-4 py-2 text-xs font-semibold text-[#7AA7D8] opacity-80"
        >
          Add email or phone to enable Save contact
        </button>

        <div className="mt-4 w-full text-left">
          <div className="text-xs font-semibold text-muted-foreground">
            Links
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-white px-4 py-4 text-center text-xs font-medium text-foreground shadow-[0_12px_24px_-18px_rgba(15,23,42,0.3)]">
              <span className="text-sm">
                <Plus className="h-4 w-4" />
              </span>
              <span>+ Add link</span>
            </div>
          </div>
        </div>

        <div className="mt-4 w-full text-xs text-muted-foreground">
          Get in Touch
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
    <div className="h-40 w-full">
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

function safeCsv(value: string) {
  if (value == null) return "";
  const needs = /[",\n]/.test(value);
  const val = String(value).replace(/"/g, '""');
  return needs ? `"${val}"` : val;
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
