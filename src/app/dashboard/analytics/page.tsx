import dynamic from "next/dynamic";

export const metadata = {
  title: "Analytics",
};

const AnalyticsContent = dynamic(
  () => import("@/components/dashboard/analytics/AnalyticsContent"),
  {
    loading: () => (
      <div className="dashboard-skeleton space-y-6">
        <div className="h-20 animate-pulse rounded-3xl bg-muted" data-skeleton />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="h-28 animate-pulse rounded-3xl bg-muted" data-skeleton />
          <div className="h-28 animate-pulse rounded-3xl bg-muted" data-skeleton />
          <div className="h-28 animate-pulse rounded-3xl bg-muted" data-skeleton />
          <div className="h-28 animate-pulse rounded-3xl bg-muted" data-skeleton />
        </div>
        <div className="h-72 animate-pulse rounded-3xl bg-muted" data-skeleton />
        <div className="h-56 animate-pulse rounded-3xl bg-muted" data-skeleton />
      </div>
    ),
  }
);

export default function AnalyticsPage() {
  return <AnalyticsContent />;
}
