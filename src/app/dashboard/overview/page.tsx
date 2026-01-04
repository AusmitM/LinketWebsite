"use client";

import { Suspense } from "react";
import OverviewContent from "@/components/dashboard/overview/OverviewContent";

function OverviewSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-md bg-muted" />
          <div className="h-4 w-64 rounded-md bg-muted" />
        </div>
        <div className="h-9 w-36 rounded-full bg-muted" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="h-48 w-full rounded-3xl bg-muted" />
          <div className="h-72 w-full rounded-3xl bg-muted" />
        </div>
        <div className="h-72 w-full rounded-3xl bg-muted lg:col-span-5" />
        <div className="h-96 w-full rounded-3xl bg-muted lg:col-span-12" />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewContent />
    </Suspense>
  );
}
