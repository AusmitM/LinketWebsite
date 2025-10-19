"use client";

import { Suspense } from "react";
import OverviewContent from "@/components/dashboard/overview/OverviewContent";

function OverviewSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-md bg-muted" />
          <div className="h-4 w-64 rounded-md bg-muted" />
        </div>
        <div className="h-9 w-36 rounded-full bg-muted" />
      </div>
      <div className="h-48 w-full rounded-3xl bg-muted" />
      <div className="h-48 w-full rounded-3xl bg-muted" />
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
