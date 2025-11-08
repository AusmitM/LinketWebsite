"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, MoveDown, MoveUp, Settings2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import { supabase } from "@/lib/supabase";
// import type { UserAnalytics } from "@/lib/analytics-service";
import {
  // processUserAnalytics,
  type UserAnalytics,
} from "@/lib/supabase-analytics";
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

type ViewState = {
  loading: boolean;
  error: string | null;
  analytics: UserAnalytics | null;
};

type ModuleKey =
  | "business-metrics"
  | "growth-trajectory"
  | "conversion-funnel"
  // | "lead-followups"
  | "top-performers";
// | "quick-actions";

type ModuleSize = "full" | "wide" | "half" | "third";

type ModuleContext = {
  loading: boolean;
  analytics: UserAnalytics | null;
  error: string | null;
  publicUrl: string | null;
};

type ModuleDefinition = {
  label: string;
  description: string;
  size: ModuleSize;
  render: (context: ModuleContext) => ReactNode;
};

const ALL_MODULES: ModuleKey[] = [
  "business-metrics",
  "growth-trajectory",
  "conversion-funnel",
  // "lead-followups",
  "top-performers",
  // "quick-actions",
];

const MODULE_STORAGE_KEY = "overview:module-preferences";

type ModulePreferences = {
  order: ModuleKey[];
  active: ModuleKey[];
};

const sizeClassMap: Record<ModuleSize, string> = {
  full: "col-span-12",
  wide: "col-span-12 xl:col-span-8",
  half: "col-span-12 xl:col-span-6",
  third: "col-span-12 xl:col-span-4",
};

const MODULE_CATALOG: Record<ModuleKey, ModuleDefinition> = {
  "business-metrics": {
    label: "Business pulse",
    description: "Daily performance snapshot and active Linket health.",
    size: "full",
    render: BusinessMetricsModule,
  },
  "growth-trajectory": {
    label: "Engagement trend",
    description: "Scans and leads over time.",
    size: "full",
    render: GrowthTrajectoryModule,
  },
  "conversion-funnel": {
    label: "Conversion funnel",
    description: "Understand how taps become warm leads.",
    size: "half",
    render: ConversionFunnelModule,
  },
  // "lead-followups": {
  //   label: "Lead follow-ups",
  //   description: "Latest leads with contact details.",
  //   size: "half",
  //   render: LeadFollowupModule,
  // },
  "top-performers": {
    label: "Top Linkets",
    description: "Linkets delivering the most scans and leads.",
    size: "half",
    render: TopPerformersModule,
  },
  // "quick-actions": {
  //   label: "Quick actions",
  //   description: "Jump into the workflows you use most.",
  //   size: "third",
  //   render: QuickActionsModule,
  // },
};

export default function OverviewContent() {
  const dashboardUser = useDashboardUser();
  console.log("DASHBOARD USER:", dashboardUser);
  const [userId, setUserId] = useState<string | null | undefined>(
    dashboardUser?.id ?? undefined
  );
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [{ loading, error, analytics }, setState] = useState<ViewState>({
    loading: true,
    error: null,
    analytics: null,
  });

  const [modulePrefs, setModulePrefs] = useState<ModulePreferences>({
    order: ALL_MODULES,
    active: ALL_MODULES,
  });
  const [customizerOpen, setCustomizerOpen] = useState(false);

  useEffect(() => {
    if (dashboardUser?.id) {
      setUserId(dashboardUser.id);
    }
  }, [dashboardUser]);

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
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(MODULE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ModulePreferences;
      const order = Array.isArray(parsed?.order)
        ? parsed.order.filter((key): key is ModuleKey =>
            ALL_MODULES.includes(key)
          )
        : ALL_MODULES;
      const active = Array.isArray(parsed?.active)
        ? parsed.active.filter((key): key is ModuleKey =>
            ALL_MODULES.includes(key)
          )
        : ALL_MODULES;
      setModulePrefs({
        order: order.length ? order : ALL_MODULES,
        active: active.length ? active : ALL_MODULES,
      });
    } catch {
      // ignore parse errors
    }
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
        )}&days=30`;
        const profilesUrl = `/api/linket-profiles?userId=${encodeURIComponent(
          resolvedUserId
        )}`;
        const handleUrl = `/api/account/handle?userId=${encodeURIComponent(
          resolvedUserId
        )}`;

        const [analyticsRes, profilesRes, handleRes] = await Promise.all([
          fetch(analyticsUrl, { cache: "no-store" }),
          fetch(profilesUrl, { cache: "no-store" }),
          fetch(handleUrl, { cache: "no-store" }),
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

        if (profilesRes.ok) {
          const profiles = (await profilesRes.json().catch(() => [])) as Array<{
            id: string;
            handle: string;
            is_active: boolean;
          }>;
          const accountPayload = handleRes.ok
            ? await handleRes.json().catch(() => null)
            : null;
          const activeProfile =
            profiles.find((p) => p.is_active) ?? profiles[0] ?? null;
          if (activeProfile) {
            const handle =
              typeof accountPayload?.handle === "string"
                ? accountPayload.handle
                : activeProfile.handle;
            const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
            setPublicUrl(`${base}/u/${encodeURIComponent(handle)}`);
          } else {
            setPublicUrl(null);
          }
        }
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

  const persistPreferences = useCallback((prefs: ModulePreferences) => {
    setModulePrefs(prefs);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(prefs));
    }
  }, []);

  const toggleModule = useCallback((key: ModuleKey, enabled: boolean) => {
    setModulePrefs((prev) => {
      if (enabled) {
        if (prev.active.includes(key)) return prev;
        const next = [...prev.active, key];
        const prefs = { ...prev, active: next };
        if (typeof window !== "undefined")
          window.localStorage.setItem(
            MODULE_STORAGE_KEY,
            JSON.stringify(prefs)
          );
        return prefs;
      }
      if (prev.active.length === 1 && prev.active[0] === key) {
        return prev;
      }
      const next = prev.active.filter((item) => item !== key);
      const prefs = { ...prev, active: next };
      if (typeof window !== "undefined")
        window.localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(prefs));
      return prefs;
    });
  }, []);

  const moveModule = useCallback((key: ModuleKey, direction: "up" | "down") => {
    setModulePrefs((prev) => {
      const order = [...prev.order];
      const index = order.indexOf(key);
      if (index === -1) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= order.length) return prev;
      const [removed] = order.splice(index, 1);
      order.splice(nextIndex, 0, removed);
      const prefs = { ...prev, order };
      if (typeof window !== "undefined")
        window.localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(prefs));
      return prefs;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    const defaults = { order: ALL_MODULES, active: ALL_MODULES };
    persistPreferences(defaults);
  }, [persistPreferences]);

  const activeModules = useMemo(() => {
    const activeSet = new Set(modulePrefs.active);
    return modulePrefs.order.filter((key) => activeSet.has(key));
  }, [modulePrefs]);

  const moduleContext = useMemo<ModuleContext>(
    () => ({
      loading,
      analytics,
      error,
      publicUrl,
    }),
    [loading, analytics, error, publicUrl]
  );

  const lastUpdated = analytics?.meta.generatedAt
    ? timestampFormatter.format(new Date(analytics.meta.generatedAt))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Track how Linkets perform and surface the metrics your business
            cares about. {lastUpdated ? `Last updated ${lastUpdated}.` : ""}
          </p>
        </div>
        <Dialog open={customizerOpen} onOpenChange={setCustomizerOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="inline-flex items-center gap-2 rounded-full"
            >
              <Settings2 className="h-4 w-4" aria-hidden />
              Customize overview
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Customize your overview</DialogTitle>
              <DialogDescription>
                Toggle modules on or off and arrange them so the information you
                value most is front and centre.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {modulePrefs.order.map((key) => {
                const definition = MODULE_CATALOG[key];
                const isActive = modulePrefs.active.includes(key);
                return (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-card/70 p-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {definition.label}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {definition.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <button
                          type="button"
                          aria-label="Move module up"
                          onClick={() => moveModule(key, "up")}
                          disabled={modulePrefs.order[0] === key}
                          className="inline-flex rounded-full border border-border/60 bg-background p-1 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                        >
                          <MoveUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label="Move module down"
                          onClick={() => moveModule(key, "down")}
                          disabled={
                            modulePrefs.order[modulePrefs.order.length - 1] ===
                            key
                          }
                          className="inline-flex rounded-full border border-border/60 bg-background p-1 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                        >
                          <MoveDown className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) =>
                          toggleModule(key, checked)
                        }
                        aria-label={`Toggle ${definition.label}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={resetPreferences}>
                Restore defaults
              </Button>
              <Button
                onClick={() => setCustomizerOpen(false)}
                className="rounded-full px-6"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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

      <div className="grid gap-6 xl:grid-cols-12">
        {activeModules.length === 0 ? (
          <Card className="col-span-12 rounded-3xl border bg-card/80 shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                You’ve hidden every module. Choose the widgets that matter most
                to your business and we’ll pin them here.
              </p>
              <Button
                className="rounded-full px-5"
                onClick={() => setCustomizerOpen(true)}
              >
                Add dashboard widgets
              </Button>
            </CardContent>
          </Card>
        ) : (
          activeModules.map((key) => {
            const definition = MODULE_CATALOG[key];
            const element = definition.render(moduleContext);
            if (!element) return null;
            return (
              <div key={key} className={sizeClassMap[definition.size]}>
                {element}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function BusinessMetricsModule({ analytics, loading }: ModuleContext) {
  if (loading && !analytics) {
    return (
      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
            Business pulse
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Daily performance snapshot.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonStatCard key={`metric-skeleton-${index}`} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!analytics?.totals) {
    return (
      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
            Business pulse
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Daily performance snapshot.
          </p>
        </CardHeader>
        <CardContent>
          <EmptyState message="Connect your analytics to see scans, leads, and conversion data." />
        </CardContent>
      </Card>
    );
  }

  const totals = analytics.totals;
  const cards = [
    {
      label: "Taps today",
      value: numberFormatter.format(totals.scansToday),
      helper: totals.lastScanAt
        ? `Last tap ${timestampFormatter.format(new Date(totals.lastScanAt))}`
        : "No taps yet today",
    },
    {
      label: "Leads today",
      value: numberFormatter.format(totals.leadsToday),
      helper:
        totals.leadsToday > 0
          ? "Follow up within 24 hours"
          : "No new leads yet",
    },
    {
      label: "7-day conversion",
      value: percentFormatter.format(totals.conversionRate7d || 0),
      helper: `${numberFormatter.format(
        totals.leads7d
      )} leads from ${numberFormatter.format(totals.scans7d)} taps`,
    },
    {
      label: "Active Linkets",
      value: numberFormatter.format(totals.activeTags),
      helper:
        totals.activeTags > 0
          ? "Linkets that recorded taps this week"
          : "Assign Linkets to team members",
    },
  ];

  return (
    <Card className="rounded-3xl border bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
          Business pulse
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Daily performance snapshot.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </CardContent>
    </Card>
  );
}

function GrowthTrajectoryModule({ analytics, loading }: ModuleContext) {
  const data = analytics?.timeline ?? [];

  return (
    <Card className="rounded-3xl border bg-card/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">
            Engagement trend
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Scans and leads recorded over time.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !analytics ? (
          <div className="h-56 animate-pulse rounded-2xl bg-muted" />
        ) : data.length ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.map((point) => ({
                  ...point,
                  label: shortDate.format(new Date(point.date)),
                }))}
              >
                <CartesianGrid
                  stroke="rgba(148, 163, 184, 0.2)"
                  strokeDasharray="8 5"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 12, fill: "currentColor" }}
                />
                <YAxis
                  tickFormatter={(value) => numberFormatter.format(value)}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 12, fill: "currentColor" }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="scans"
                  name="Scans"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  strokeWidth={2}
                  fillOpacity={0.15}
                />
                <Area
                  type="monotone"
                  dataKey="leads"
                  name="Leads"
                  stroke="var(--accent)"
                  fill="var(--accent)"
                  strokeWidth={2}
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="Once your Linkets start receiving traffic you'll see trends here." />
        )}
      </CardContent>
    </Card>
  );
}

function ConversionFunnelModule({
  analytics,
  loading,
  publicUrl,
}: ModuleContext) {
  if (loading && !analytics) {
    return (
      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardContent className="py-12">
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const totals = analytics?.totals;
  const scans7d = totals?.scans7d ?? 0;
  const leads7d = totals?.leads7d ?? 0;
  const conversion = totals?.conversionRate7d ?? 0;
  const leadPerLinket =
    totals && totals.activeTags > 0
      ? `${(totals.leads7d / totals.activeTags).toFixed(
          1
        )} leads / active Linket`
      : "Assign Linkets to start tracking";

  return (
    <Card className="rounded-3xl border bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Conversion funnel
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tap-to-lead performance over the last 7 days.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <SnapshotRow
            label="Total taps"
            value={numberFormatter.format(scans7d)}
            helper="Across every active Linket"
          />
          <SnapshotRow
            label="Leads captured"
            value={numberFormatter.format(leads7d)}
            helper={leadPerLinket}
          />
          <SnapshotRow
            label="Conversion rate"
            value={percentFormatter.format(conversion || 0)}
            helper="Leads / taps last 7 days"
          />
        </div>
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Want more taps? Share your public profile with prospects:
          <div className="mt-2 inline-flex items-center gap-2">
            <Link
              href={publicUrl ?? "/dashboard/profiles"}
              className="truncate rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-foreground hover:border-border"
              title={publicUrl ?? undefined}
            >
              {publicUrl ?? "Set active profile"}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// function LeadFollowupModule({ analytics, loading }: ModuleContext) {
//   return (
//     <Card className="rounded-3xl border bg-card/80 shadow-sm">
//       <CardHeader>
//         <CardTitle className="text-lg font-semibold">Lead follow-ups</CardTitle>
//         <p className="text-sm text-muted-foreground">
//           Reach out while you’re still top-of-mind.
//         </p>
//       </CardHeader>
//       <CardContent>
//         {loading && !analytics ? (
//           <div className="space-y-3">
//             {Array.from({ length: 4 }).map((_, index) => (
//               <div
//                 key={index}
//                 className="h-12 animate-pulse rounded-2xl bg-muted"
//               />
//             ))}
//           </div>
//         ) : analytics?.recentLeads?.length ? (
//           <div className="grid gap-3">
//             {analytics.recentLeads.slice(0, 5).map((lead) => (
//               <div
//                 key={lead.id}
//                 className="flex flex-col gap-1 rounded-2xl border border-border/70 bg-background/60 p-3 text-sm"
//               >
//                 <div className="flex flex-wrap items-center justify-between gap-2">
//                   <div className="font-medium text-foreground">
//                     {lead.name || "Unnamed lead"}
//                   </div>
//                   <span className="text-xs text-muted-foreground">
//                     {shortDate.format(new Date(lead.created_at))}
//                   </span>
//                 </div>
//                 <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
//                   {lead.email && (
//                     <a
//                       href={`mailto:${lead.email}`}
//                       className="truncate text-primary underline"
//                     >
//                       {lead.email}
//                     </a>
//                   )}
//                   {lead.phone && (
//                     <a
//                       href={`tel:${lead.phone}`}
//                       className="truncate text-primary underline"
//                     >
//                       {lead.phone}
//                     </a>
//                   )}
//                   {lead.company && (
//                     <span className="truncate">{lead.company}</span>
//                   )}
//                 </div>
//                 {lead.message && (
//                   <blockquote className="rounded-xl border border-dashed border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
//                     {lead.message}
//                   </blockquote>
//                 )}
//               </div>
//             ))}
//             <Button
//               asChild
//               variant="outline"
//               className="mt-1 w-full rounded-full text-sm"
//             >
//               <Link href="/dashboard/leads">View all leads</Link>
//             </Button>
//           </div>
//         ) : (
//           <EmptyState message="No leads captured in this window." />
//         )}
//       </CardContent>
//     </Card>
//   );
// }

function TopPerformersModule({ analytics, loading }: ModuleContext) {
  return (
    <Card className="rounded-3xl border bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5 text-primary" aria-hidden />
          Top Linkets
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Who&apos;s bringing in the most interest this week.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !analytics ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-2xl bg-muted" />
            <div className="h-12 animate-pulse rounded-2xl bg-muted" />
            <div className="h-12 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : analytics?.topProfiles?.length ? (
          analytics.topProfiles.slice(0, 5).map((profile) => {
            const key = `${profile.profileId ?? "np"}-${
              profile.handle ?? "nh"
            }`;
            const subtitle = profile.handle
              ? `linket.co/u/${profile.handle}`
              : profile.nickname || "Unassigned";
            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-2xl border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium text-foreground">
                    {profile.displayName || "Linket"}
                  </div>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground">
                    {numberFormatter.format(profile.scans)} taps
                  </div>
                  <div>
                    {profile.leads
                      ? `${numberFormatter.format(profile.leads)} leads`
                      : "0 leads"}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState message="No activity yet. Share your Linkets to start ranking results." />
        )}
      </CardContent>
    </Card>
  );
}

// function QuickActionsModule({ publicUrl }: ModuleContext) {
//   return (
//     <Card className="rounded-3xl border bg-card/80 shadow-sm">
//       <CardHeader>
//         <CardTitle className="flex items-center gap-2 text-lg font-semibold">
//           <Building2 className="h-5 w-5 text-primary" aria-hidden />
//           Quick actions
//         </CardTitle>
//         <p className="text-sm text-muted-foreground">
//           Keep momentum with the next best step.
//         </p>
//       </CardHeader>
//       <CardContent className="grid gap-3">
//         <Button
//           asChild
//           className="w-full justify-start rounded-2xl bg-primary/90 text-primary-foreground hover:bg-primary"
//         >
//           <Link href={publicUrl ?? "/dashboard/profiles"}>
//             <Share2 className="mr-2 h-4 w-4" aria-hidden />
//             {publicUrl
//               ? "Share public profile"
//               : "Activate your public profile"}
//           </Link>
//         </Button>
//         <Button
//           asChild
//           variant="outline"
//           className="w-full justify-start rounded-2xl"
//         >
//           <Link href="/dashboard/linkets">
//             <Users className="mr-2 h-4 w-4" aria-hidden />
//             Assign a new Linket
//           </Link>
//         </Button>
//         <Button
//           asChild
//           variant="ghost"
//           className="w-full justify-start rounded-2xl"
//         >
//           <Link href="/dashboard/leads">
//             <Download className="mr-2 h-4 w-4" aria-hidden />
//             Export latest leads
//           </Link>
//         </Button>
//       </CardContent>
//     </Card>
//   );
// }

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Card className="rounded-2xl border bg-background/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-3xl font-semibold text-foreground">{value}</div>
        {helper && (
          <div className="text-xs text-muted-foreground">{helper}</div>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonStatCard() {
  return <div className="h-32 animate-pulse rounded-2xl bg-muted" />;
}

function SnapshotRow({
  label,
  value,
  helper,
  ctaHref,
  ctaLabel,
}: {
  label: string;
  value: string;
  helper?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-foreground">{value}</div>
        {ctaHref && ctaLabel && (
          <Link
            href={ctaHref}
            className="text-xs font-medium text-primary underline"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
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
  const scans = payload.find((item) => item.name === "Scans")?.value ?? 0;
  const leads = payload.find((item) => item.name === "Leads")?.value ?? 0;
  return (
    <div className="rounded-md border border-border/70 bg-background/95 px-3 py-2 text-xs shadow">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Scans</span>
          <span className="font-medium text-foreground">
            {numberFormatter.format(scans)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Leads</span>
          <span className="font-medium text-foreground">
            {numberFormatter.format(leads)}
          </span>
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
